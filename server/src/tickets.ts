import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Priority } from '@prisma/client'
import { prisma } from './prisma.js'
import { requireDevRequester } from './dev-requester-context.js'
import { validateTicketFields } from './ticket-rules.js'

export const ticketsRouter = Router()

type CreateTicketBody = {
  categoryId?: unknown
  relatedSystemId?: unknown
  requestedPriority?: unknown
  summary?: unknown
  description?: unknown
}

function generateTicketNumber(id: number, createdAt: Date): string {
  const year = createdAt.getUTCFullYear()
  const paddedId = String(id).padStart(6, '0')
  return `TKT-${year}-${paddedId}`
}

function toInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

ticketsRouter.post('/', requireDevRequester, async (request, response, next) => {
  try {
    const body = request.body as CreateTicketBody

    const categoryId = toInteger(body.categoryId)
    const relatedSystemId = toInteger(body.relatedSystemId)
    const requestedPriority = typeof body.requestedPriority === 'string' ? body.requestedPriority : ''
    const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''

    const fields = validateTicketFields({
      categoryId,
      relatedSystemId,
      requestedPriority,
      summary,
      description,
    })

    if (categoryId !== null && !fields.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId } })
      if (!category || !category.isActive) {
        fields.categoryId = 'Category is required.'
      }
    }

    if (relatedSystemId !== null && !fields.relatedSystemId) {
      const relatedSystem = await prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } })
      if (!relatedSystem || !relatedSystem.isActive) {
        fields.relatedSystemId = 'Related System is required.'
      }
    }

    if (Object.keys(fields).length > 0) {
      response.status(400).json({ error: 'VALIDATION_FAILED', fields })
      return
    }

    const requesterId = response.locals.devRequesterId as number

    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          ticketNumber: `PENDING-${randomUUID()}`,
          requesterId,
          categoryId: categoryId as number,
          relatedSystemId: relatedSystemId as number,
          requestedPriority: requestedPriority as Priority,
          summary,
          description,
        },
      })

      return tx.ticket.update({
        where: { id: created.id },
        data: { ticketNumber: generateTicketNumber(created.id, created.createdAt) },
      })
    })

    response.status(201).json(ticket)
  } catch (error) {
    next(error)
  }
})
