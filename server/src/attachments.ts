import { Router, type NextFunction, type Request, type Response } from 'express'
import multer, { MulterError } from 'multer'
import {
  isAllowedExtensionMimePair,
  isRemovalReasonValid,
  MAX_ACTIVE_ATTACHMENTS,
  MAX_FILE_SIZE_BYTES,
} from '@toktickit/shared'
import { prisma } from './prisma.js'
import { requireSession, requirePasswordAlreadyChanged } from './auth/require-session.js'
import { requireRole } from './authorization/require-role.js'
import { resolveOwnedTicket, resolveOwnedAttachment, respondOwnershipFailure } from './ticket-ownership.js'
import {
  buildStoragePath,
  isFileContentValid,
  readAttachmentFile,
  sanitizeDownloadFilename,
  saveAttachmentFile,
} from './attachment-storage.js'
import { unlink } from 'node:fs/promises'

export const ticketAttachmentsRouter = Router({ mergeParams: true })
export const attachmentsRouter = Router()

// Upload/remove stay Requester-only (ui-spec.md §6: "IT Staff cannot
// remove a Requester's attachment"). List/download additionally allow
// IT Staff/Admin to view any ticket's attachments, matching Comments.
const requireRequester = [requireSession, requirePasswordAlreadyChanged, requireRole('REQUESTER')]
const requireReadAccess = [
  requireSession,
  requirePasswordAlreadyChanged,
  requireRole('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'),
]

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } })

function handleUpload(request: Request, response: Response, next: NextFunction) {
  upload.single('file')(request, response, (error: unknown) => {
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      response.status(400).json({ error: 'FILE_TOO_LARGE', message: 'Maximum size is 5 MB.' })
      return
    }
    if (error) {
      next(error)
      return
    }
    next()
  })
}

function toInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

class AttachmentLimitReachedError extends Error {}

/** Requester must own the ticket; IT Staff/Admin can read any ticket's attachments. */
async function checkTicketReadAccess(
  ticketId: number,
  userId: number,
  role: string,
  response: Response,
): Promise<boolean> {
  if (role !== 'REQUESTER') {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return false
    }
    return true
  }

  const ownership = await resolveOwnedTicket(ticketId, userId)
  if (ownership.status !== 'ok') {
    respondOwnershipFailure(response, ownership, { notFound: 'TICKET_NOT_FOUND', forbidden: 'TICKET_FORBIDDEN' })
    return false
  }
  return true
}

ticketAttachmentsRouter.post('/', ...requireRequester, handleUpload, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const requesterId = response.locals.userId as number

    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    const ownership = await resolveOwnedTicket(ticketId, requesterId)
    if (ownership.status !== 'ok') {
      respondOwnershipFailure(response, ownership, { notFound: 'TICKET_NOT_FOUND', forbidden: 'TICKET_FORBIDDEN' })
      return
    }

    const file = request.file
    if (!file) {
      response.status(400).json({ error: 'FILE_REQUIRED' })
      return
    }

    if (!isAllowedExtensionMimePair(file.originalname, file.mimetype) || !isFileContentValid(file.buffer)) {
      response
        .status(400)
        .json({ error: 'UNSUPPORTED_FILE_TYPE', message: 'Allowed types: JPG, PNG, WEBP, PDF.' })
      return
    }

    const { relativePath, absolutePath } = buildStoragePath(ticketId, file.originalname)
    await saveAttachmentFile(absolutePath, file.buffer)

    try {
      const attachment = await prisma.$transaction(async (tx) => {
        // Locks the ticket row so two concurrent uploads to the same ticket
        // can't both read "4 active attachments" and both insert a 5th.
        await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`

        const activeCount = await tx.attachment.count({ where: { ticketId, isRemoved: false } })
        if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
          throw new AttachmentLimitReachedError()
        }

        return tx.attachment.create({
          data: {
            ticketId,
            originalFilename: file.originalname,
            storedPath: relativePath,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        })
      })

      response.status(201).json(attachment)
    } catch (transactionError) {
      // The DB didn't accept the row, so the file we just wrote is now an
      // orphan on disk — clean it up rather than leaking storage.
      await unlink(absolutePath).catch(() => {})

      if (transactionError instanceof AttachmentLimitReachedError) {
        response.status(400).json({
          error: 'ATTACHMENT_LIMIT_REACHED',
          message: `A Ticket may have at most ${MAX_ACTIVE_ATTACHMENTS} active attachments.`,
        })
        return
      }
      throw transactionError
    }
  } catch (error) {
    next(error)
  }
})

ticketAttachmentsRouter.get('/', ...requireReadAccess, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const userId = response.locals.userId as number
    const role = response.locals.userRole as string

    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    if (!(await checkTicketReadAccess(ticketId, userId, role, response))) return

    const attachments = await prisma.attachment.findMany({
      where: { ticketId },
      orderBy: { uploadedAt: 'asc' },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        uploadedAt: true,
        isRemoved: true,
        removedAt: true,
        removedReason: true,
      },
    })

    response.status(200).json(attachments)
  } catch (error) {
    next(error)
  }
})

attachmentsRouter.get('/:id/download', ...requireReadAccess, async (request, response, next) => {
  try {
    const attachmentId = toInteger(request.params.id)
    const userId = response.locals.userId as number
    const role = response.locals.userRole as string

    if (attachmentId === null) {
      response.status(404).json({ error: 'ATTACHMENT_NOT_FOUND' })
      return
    }

    let attachment
    if (role !== 'REQUESTER') {
      attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } })
      if (!attachment) {
        response.status(404).json({ error: 'ATTACHMENT_NOT_FOUND' })
        return
      }
    } else {
      const ownership = await resolveOwnedAttachment(attachmentId, userId)
      if (ownership.status !== 'ok') {
        respondOwnershipFailure(response, ownership, {
          notFound: 'ATTACHMENT_NOT_FOUND',
          forbidden: 'ATTACHMENT_FORBIDDEN',
        })
        return
      }
      attachment = ownership.value
    }

    if (attachment.isRemoved) {
      response.status(410).json({ error: 'ATTACHMENT_REMOVED' })
      return
    }

    const buffer = await readAttachmentFile(attachment.storedPath)
    const safeFilename = sanitizeDownloadFilename(attachment.originalFilename)

    response.status(200)
    response.setHeader('Content-Type', attachment.mimeType)
    response.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.send(buffer)
  } catch (error) {
    next(error)
  }
})

attachmentsRouter.delete('/:id', ...requireRequester, async (request, response, next) => {
  try {
    const attachmentId = toInteger(request.params.id)
    const requesterId = response.locals.userId as number

    if (attachmentId === null) {
      response.status(404).json({ error: 'ATTACHMENT_NOT_FOUND' })
      return
    }

    const ownership = await resolveOwnedAttachment(attachmentId, requesterId)
    if (ownership.status !== 'ok') {
      respondOwnershipFailure(response, ownership, {
        notFound: 'ATTACHMENT_NOT_FOUND',
        forbidden: 'ATTACHMENT_FORBIDDEN',
      })
      return
    }

    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : ''
    if (!isRemovalReasonValid(reason)) {
      response.status(400).json({ error: 'REASON_REQUIRED', message: 'Provide a reason (3-200 characters).' })
      return
    }

    // Atomic check-and-set on isRemoved avoids a TOCTOU gap between reading
    // the current state and writing the removal — two concurrent DELETEs
    // can't both "win".
    const removed = await prisma.attachment.updateMany({
      where: { id: attachmentId, isRemoved: false },
      data: { isRemoved: true, removedAt: new Date(), removedReason: reason },
    })

    if (removed.count === 0) {
      response.status(400).json({ error: 'ALREADY_REMOVED' })
      return
    }

    const updated = await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentId } })
    response.status(200).json(updated)
  } catch (error) {
    next(error)
  }
})
