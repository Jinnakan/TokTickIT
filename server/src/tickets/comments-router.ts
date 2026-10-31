import { guardFor } from '../http/guards.js'
import { parseId } from '../http/params.js'
import { Router } from 'express'
import { prisma } from '../prisma.js'
import { touchTicket } from './touch-ticket.js'
import { checkTicketAccess } from '../authorization/ticket-access.js'

export const commentsRouter = Router({ mergeParams: true })

// Requester (own ticket only) or IT Staff/Admin (any ticket, api-spec.md §3).
const requireCommentAccess = guardFor('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR')

const MIN_BODY_LENGTH = 1
const MAX_BODY_LENGTH = 2000

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

commentsRouter.get('/', ...requireCommentAccess, async (request, response, next) => {
  try {
    const ticketId = parseId(request.params.ticketId)
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
    const ticketId = parseId(request.params.ticketId)
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
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.publicComment.create({
        data: { ticketId, authorId: userId, body },
        include: { author: { select: { name: true } } },
      })
      await touchTicket(tx, ticketId)
      return created
    })

    response.status(201).json(toCommentResponse(comment))
  } catch (error) {
    next(error)
  }
})
