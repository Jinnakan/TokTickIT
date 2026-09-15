import { Router } from 'express'
import { prisma } from './prisma.js'
import { requireSession, requirePasswordAlreadyChanged } from './auth/require-session.js'
import { requireRole } from './authorization/require-role.js'
import { resolveOwnedTicket, respondOwnershipFailure } from './ticket-ownership.js'

export const commentsRouter = Router({ mergeParams: true })

// Requester (own ticket only) or IT Staff/Admin (any ticket, api-spec.md §3).
const requireCommentAccess = [
  requireSession,
  requirePasswordAlreadyChanged,
  requireRole('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'),
]

const MIN_BODY_LENGTH = 1
const MAX_BODY_LENGTH = 2000

function toInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function toCommentResponse(comment: { id: number; ticketId: number; authorId: number; body: string; createdAt: Date; author: { name: string } }) {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    authorId: comment.authorId,
    authorName: comment.author.name,
    body: comment.body,
    createdAt: comment.createdAt,
  }
}

/**
 * A Requester must own the ticket; IT Staff/Admin can access any ticket's
 * comments. Returns null (having already written the response) on failure.
 */
async function checkTicketAccess(
  ticketId: number,
  userId: number,
  role: string,
  response: import('express').Response,
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

commentsRouter.get('/', ...requireCommentAccess, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const userId = response.locals.userId as number
    const role = response.locals.userRole as string

    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    if (!(await checkTicketAccess(ticketId, userId, role, response))) return

    const comments = await prisma.publicComment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { name: true } } },
    })

    response.status(200).json(comments.map(toCommentResponse))
  } catch (error) {
    next(error)
  }
})

commentsRouter.post('/', ...requireCommentAccess, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const userId = response.locals.userId as number
    const role = response.locals.userRole as string

    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    if (!(await checkTicketAccess(ticketId, userId, role, response))) return

    const body = typeof request.body?.body === 'string' ? request.body.body.trim() : ''
    if (body.length < MIN_BODY_LENGTH || body.length > MAX_BODY_LENGTH) {
      response.status(400).json({
        error: 'VALIDATION_FAILED',
        fields: { body: `Comment must be 1-${MAX_BODY_LENGTH} characters.` },
      })
      return
    }

    // Stored and returned verbatim (BR-L3-12) -- the client renders it as
    // plain text only, never dangerouslySetInnerHTML, so no server-side
    // sanitization/transformation is needed or done here.
    const comment = await prisma.publicComment.create({
      data: { ticketId, authorId: userId, body },
      include: { author: { select: { name: true } } },
    })

    response.status(201).json(toCommentResponse(comment))
  } catch (error) {
    next(error)
  }
})
