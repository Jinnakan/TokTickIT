import { Router, type NextFunction, type Request, type Response } from 'express'
import multer, { MulterError } from 'multer'
import {
  isAllowedExtensionMimePair,
  isRemovalReasonValid,
  MAX_ACTIVE_ATTACHMENTS,
  MAX_FILE_SIZE_BYTES,
} from '@toktickit/shared'
import { prisma } from './prisma.js'
import { requireDevRequester } from './dev-requester-context.js'
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

ticketAttachmentsRouter.post('/', requireDevRequester, handleUpload, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const requesterId = response.locals.devRequesterId as number

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

ticketAttachmentsRouter.get('/', requireDevRequester, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const requesterId = response.locals.devRequesterId as number

    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    const ownership = await resolveOwnedTicket(ticketId, requesterId)
    if (ownership.status !== 'ok') {
      respondOwnershipFailure(response, ownership, { notFound: 'TICKET_NOT_FOUND', forbidden: 'TICKET_FORBIDDEN' })
      return
    }

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

attachmentsRouter.get('/:id/download', requireDevRequester, async (request, response, next) => {
  try {
    const attachmentId = toInteger(request.params.id)
    const requesterId = response.locals.devRequesterId as number

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

    const attachment = ownership.value
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

attachmentsRouter.delete('/:id', requireDevRequester, async (request, response, next) => {
  try {
    const attachmentId = toInteger(request.params.id)
    const requesterId = response.locals.devRequesterId as number

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
