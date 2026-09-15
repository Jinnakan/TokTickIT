import { Router } from 'express'
import type { TicketStatus } from '@prisma/client'
import { PRIORITIES } from '@toktickit/shared'
import { prisma } from '../prisma.js'
import { requireSession, requirePasswordAlreadyChanged } from '../auth/require-session.js'
import { requireRole } from '../authorization/require-role.js'
import { getTicketState } from '../tickets/ticket-state/ticket-state-factory.js'

export const staffTicketActionsRouter = Router({ mergeParams: true })

const requireStaff = [requireSession, requirePasswordAlreadyChanged, requireRole('IT_STAFF', 'ADMINISTRATOR')]

function toInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

staffTicketActionsRouter.post('/claim', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const userId = response.locals.userId as number

    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    // Atomic check-and-set, same TOCTOU-safe pattern as Lab 2's attachment
    // removal: two concurrent claims can't both "win".
    const claimed = await prisma.ticket.updateMany({
      where: { id: ticketId, ticketOwnerId: null },
      data: { ticketOwnerId: userId },
    })

    if (claimed.count === 0) {
      const existing = await prisma.ticket.findUnique({ where: { id: ticketId } })
      if (!existing) {
        response.status(404).json({ error: 'TICKET_NOT_FOUND' })
        return
      }
      response.status(409).json({ error: 'ALREADY_CLAIMED', ticketOwnerId: existing.ticketOwnerId })
      return
    }

    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    response.status(200).json(ticket)
  } catch (error) {
    next(error)
  }
})

staffTicketActionsRouter.post('/reassign', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const ticketOwnerId = toInteger(request.body?.ticketOwnerId)

    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    if (ticketOwnerId === null) {
      response.status(400).json({ error: 'VALIDATION_FAILED', fields: { ticketOwnerId: 'ticketOwnerId is required.' } })
      return
    }

    const targetStaff = await prisma.user.findUnique({ where: { id: ticketOwnerId } })
    if (!targetStaff || targetStaff.role !== 'IT_STAFF' || !targetStaff.isActive) {
      response.status(400).json({
        error: 'VALIDATION_FAILED',
        fields: { ticketOwnerId: 'ticketOwnerId must reference an active IT Staff user.' },
      })
      return
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    const updated = await prisma.ticket.update({ where: { id: ticketId }, data: { ticketOwnerId } })
    response.status(200).json(updated)
  } catch (error) {
    next(error)
  }
})

staffTicketActionsRouter.patch('/priority', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const itPriority = request.body?.itPriority

    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    if (typeof itPriority !== 'string' || !(PRIORITIES as readonly string[]).includes(itPriority)) {
      response.status(400).json({ error: 'VALIDATION_FAILED', fields: { itPriority: 'itPriority is invalid.' } })
      return
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { itPriority: itPriority as (typeof PRIORITIES)[number] },
    })
    response.status(200).json(updated)
  } catch (error) {
    next(error)
  }
})

staffTicketActionsRouter.patch('/status', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const requestedStatus = request.body?.status as TicketStatus | undefined

    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    const state = getTicketState(ticket.currentStatus)

    if (!requestedStatus || !state.canTransitionTo(requestedStatus)) {
      response.status(409).json({
        error: 'INVALID_TRANSITION',
        from: ticket.currentStatus,
        to: requestedStatus ?? null,
        allowed: state.allowedActions(),
      })
      return
    }

    const updated = await prisma.ticket.update({ where: { id: ticketId }, data: { currentStatus: requestedStatus } })
    response.status(200).json(updated)
  } catch (error) {
    next(error)
  }
})
