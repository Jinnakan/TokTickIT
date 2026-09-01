import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Prisma, Priority, TicketStatus } from '@prisma/client'
import { prisma } from './prisma.js'
import { requireDevRequester } from './dev-requester-context.js'
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PRIORITIES,
  SORT_DIRECTIONS,
  TICKET_SORT_FIELDS,
  TICKET_STATUSES,
  validateTicketFields,
  type FieldErrors,
  type SortDirection,
  type TicketSortField,
} from './ticket-rules.js'

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

/** `undefined` = param omitted (fine); `null` = param present but not an integer (error). */
function parseOptionalInteger(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  return toInteger(value)
}

/** `undefined` = param omitted (fine); `null` = param present but not one of `allowed` (error). */
function parseOptionalEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T
  }
  return null
}

type TicketListQuery = {
  search: string
  categoryId?: number
  requestedPriority?: Priority
  currentStatus?: TicketStatus
  sortBy: TicketSortField
  sortDir: SortDirection
  page: number
  pageSize: number
}

function parseTicketListQuery(query: Record<string, unknown>): { query: TicketListQuery; errors: FieldErrors } {
  const errors: FieldErrors = {}

  const categoryId = parseOptionalInteger(query.categoryId)
  if (categoryId === null) errors.categoryId = 'categoryId must be an integer.'

  const requestedPriority = parseOptionalEnum(query.requestedPriority, PRIORITIES)
  if (requestedPriority === null) errors.requestedPriority = 'requestedPriority is invalid.'

  const currentStatus = parseOptionalEnum(query.currentStatus, TICKET_STATUSES)
  if (currentStatus === null) errors.currentStatus = 'currentStatus is invalid.'

  const sortByRaw = parseOptionalEnum(query.sortBy, TICKET_SORT_FIELDS)
  if (sortByRaw === null) errors.sortBy = 'sortBy is invalid.'

  const sortDirRaw = parseOptionalEnum(query.sortDir, SORT_DIRECTIONS)
  if (sortDirRaw === null) errors.sortDir = 'sortDir is invalid.'

  const pageRaw = parseOptionalInteger(query.page)
  if (pageRaw === null) errors.page = 'page must be an integer.'

  const pageSizeRaw = parseOptionalInteger(query.pageSize)
  if (pageSizeRaw === null) errors.pageSize = 'pageSize must be an integer.'

  return {
    errors,
    query: {
      search: typeof query.search === 'string' ? query.search.trim() : '',
      categoryId: categoryId ?? undefined,
      requestedPriority: requestedPriority ?? undefined,
      currentStatus: currentStatus ?? undefined,
      sortBy: sortByRaw ?? 'createdAt',
      sortDir: sortDirRaw ?? 'desc',
      page: Math.max(DEFAULT_PAGE, pageRaw ?? DEFAULT_PAGE),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw ?? DEFAULT_PAGE_SIZE)),
    },
  }
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

ticketsRouter.get('/', requireDevRequester, async (request, response, next) => {
  try {
    const { query, errors } = parseTicketListQuery(request.query as Record<string, unknown>)

    if (Object.keys(errors).length > 0) {
      response.status(400).json({ error: 'VALIDATION_FAILED', fields: errors })
      return
    }

    const requesterId = response.locals.devRequesterId as number

    const where: Prisma.TicketWhereInput = {
      requesterId,
      ...(query.categoryId !== undefined ? { categoryId: query.categoryId } : {}),
      ...(query.requestedPriority !== undefined ? { requestedPriority: query.requestedPriority } : {}),
      ...(query.currentStatus !== undefined ? { currentStatus: query.currentStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { ticketNumber: { contains: query.search, mode: 'insensitive' } },
              { summary: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [tickets, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          categoryId: true,
          requestedPriority: true,
          currentStatus: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ [query.sortBy]: query.sortDir }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.ticket.count({ where }),
    ])

    response.status(200).json({
      data: tickets,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    })
  } catch (error) {
    next(error)
  }
})
