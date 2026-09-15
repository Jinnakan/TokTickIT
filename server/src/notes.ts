import { Router } from 'express'
import { prisma } from './prisma.js'
import { requireSession, requirePasswordAlreadyChanged } from './auth/require-session.js'
import { requireRole } from './authorization/require-role.js'

export const notesRouter = Router({ mergeParams: true })

// IT Staff/Admin only. A Requester gets 403 FORBIDDEN from requireRole
// itself, before any ticket lookup -- even for their own ticket (BR-L3-17,
// AC-L3-08). They never learn whether the ticket has notes, only that this
// sub-resource isn't theirs to see.
const requireStaff = [requireSession, requirePasswordAlreadyChanged, requireRole('IT_STAFF', 'ADMINISTRATOR')]

const MIN_BODY_LENGTH = 1
const MAX_BODY_LENGTH = 2000

function toInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function toNoteResponse(note: { id: number; ticketId: number; authorId: number; body: string; createdAt: Date; author: { name: string } }) {
  return {
    id: note.id,
    ticketId: note.ticketId,
    authorId: note.authorId,
    authorName: note.author.name,
    body: note.body,
    createdAt: note.createdAt,
  }
}

notesRouter.get('/', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    const notes = await prisma.internalNote.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { name: true } } },
    })

    response.status(200).json(notes.map(toNoteResponse))
  } catch (error) {
    next(error)
  }
})

notesRouter.post('/', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const authorId = response.locals.userId as number

    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    const body = typeof request.body?.body === 'string' ? request.body.body.trim() : ''
    if (body.length < MIN_BODY_LENGTH || body.length > MAX_BODY_LENGTH) {
      response.status(400).json({
        error: 'VALIDATION_FAILED',
        fields: { body: `Note must be 1-${MAX_BODY_LENGTH} characters.` },
      })
      return
    }

    const note = await prisma.internalNote.create({
      data: { ticketId, authorId, body },
      include: { author: { select: { name: true } } },
    })

    response.status(201).json(toNoteResponse(note))
  } catch (error) {
    next(error)
  }
})
