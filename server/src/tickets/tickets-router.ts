import { guardFor } from '../http/guards.js'
import { parseId } from '../http/params.js'
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Priority, TicketStatus } from '@prisma/client'
import { prisma } from '../prisma.js'
import { resolveOwnedTicket, respondOwnershipFailure } from '../authorization/ticket-ownership.js'
import { TicketQueryBuilder } from './ticket-query-builder.js'
import { evaluateResolutionGate, loadActionFacts, summarizeActions } from './resolution-gate.js'
import { getTicketState } from './ticket-state/ticket-state-factory.js'
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PRIORITIES,
  SORT_DIRECTIONS,
  STATUS_GROUP_NAMES,
  TICKET_SORT_FIELDS,
  TICKET_STATUSES,
  validateTicketFields,
  type FieldErrors,
  type SortDirection,
  type StatusGroup,
  type TicketSortField,
} from '@toktickit/shared'

export const ticketsRouter = Router()

const requireRequester = guardFor('REQUESTER')
const requireAnyAuthenticatedRole = guardFor('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR')

type CreateTicketBody = {
  categoryId?: unknown
  relatedSystemId?: unknown
  requestedPriority?: unknown
  summary?: unknown
  description?: unknown
}

export function generateTicketNumber(id: number, createdAt: Date): string {
  const year = createdAt.getUTCFullYear()
  const paddedId = String(id).padStart(6, '0')
  return `TKT-${year}-${paddedId}`
}

/** `undefined` = param omitted (fine); `null` = param present but not an integer (error). */
function parseOptionalInteger(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  return parseId(value)
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
  statusGroup?: StatusGroup
  requesterReportedResolved: boolean
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

  const statusGroup = parseOptionalEnum(query.statusGroup, STATUS_GROUP_NAMES)
  if (statusGroup === null) errors.statusGroup = 'statusGroup is invalid.'

  const reported = parseOptionalEnum(query.requesterReportedResolved, ['true'] as const)
  if (reported === null) errors.requesterReportedResolved = 'requesterReportedResolved must be true.'

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
      statusGroup: statusGroup ?? undefined,
      requesterReportedResolved: reported === 'true',
      sortBy: sortByRaw ?? 'createdAt',
      sortDir: sortDirRaw ?? 'desc',
      page: Math.max(DEFAULT_PAGE, pageRaw ?? DEFAULT_PAGE),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw ?? DEFAULT_PAGE_SIZE)),
    },
  }
}

type StaffTicketListQuery = TicketListQuery & {
  itPriority?: Priority
  ticketOwnerId?: number
  unassignedOnly: boolean
}

function parseStaffTicketListQuery(
  query: Record<string, unknown>,
): { query: StaffTicketListQuery; errors: FieldErrors } {
  const base = parseTicketListQuery(query)

  const itPriority = parseOptionalEnum(query.itPriority, PRIORITIES)
  if (itPriority === null) base.errors.itPriority = 'itPriority is invalid.'

  const ticketOwnerId = parseOptionalInteger(query.ticketOwnerId)
  if (ticketOwnerId === null) base.errors.ticketOwnerId = 'ticketOwnerId must be an integer.'

  return {
    errors: base.errors,
    query: {
      ...base.query,
      itPriority: itPriority ?? undefined,
      ticketOwnerId: ticketOwnerId ?? undefined,
      unassignedOnly: query.unassignedOnly === 'true',
    },
  }
}

ticketsRouter.post('/', ...requireRequester, async (request, response, next) => {
  try {
    const body = request.body as CreateTicketBody

    const categoryId = parseId(body.categoryId)
    const relatedSystemId = parseId(body.relatedSystemId)
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

    const requesterId = response.locals.userId as number

    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          ticketNumber: `PENDING-${randomUUID()}`,
          requesterId,
          categoryId: categoryId as number,
          relatedSystemId: relatedSystemId as number,
          requestedPriority: requestedPriority as Priority,
          itPriority: requestedPriority as Priority,
          summary,
          description,
        },
      })

      await tx.ticketStatusHistory.create({
        data: { ticketId: created.id, fromStatus: null, toStatus: 'NEW', changedById: requesterId },
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

// REQUESTER keeps Lab 2's own-tickets-only behavior unchanged. IT_STAFF and
// ADMINISTRATOR get the unscoped Queue variant (api-spec.md §4), built with
// TicketQueryBuilder so its allowlisted setters are the only way a filter/
// sort value reaches Prisma (BR-L3-11).
ticketsRouter.get('/', ...requireAnyAuthenticatedRole, async (request, response, next) => {
  try {
    const role = response.locals.userRole as string

    if (role === 'REQUESTER') {
      const { query, errors } = parseTicketListQuery(request.query as Record<string, unknown>)

      if (Object.keys(errors).length > 0) {
        response.status(400).json({ error: 'VALIDATION_FAILED', fields: errors })
        return
      }

      const requesterId = response.locals.userId as number

      const built = new TicketQueryBuilder()
        .withRequester(requesterId)
        .withSearch(query.search || undefined)
        .withCategory(query.categoryId)
        .withRequestedPriority(query.requestedPriority)
        .withStatus(query.currentStatus)
        .withStatusGroup(query.statusGroup)
        .reportedResolved(query.requesterReportedResolved)
        .sortBy(query.sortBy, query.sortDir)
        .paginate(query.page, query.pageSize)
        .build()

      const [tickets, totalItems] = await Promise.all([
        prisma.ticket.findMany({
          where: built.where,
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
          orderBy: built.orderBy,
          skip: built.skip,
          take: built.take,
        }),
        prisma.ticket.count({ where: built.where }),
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
      return
    }

    const { query, errors } = parseStaffTicketListQuery(request.query as Record<string, unknown>)

    if (Object.keys(errors).length > 0) {
      response.status(400).json({ error: 'VALIDATION_FAILED', fields: errors })
      return
    }

    const { where, orderBy, skip, take } = new TicketQueryBuilder()
      .withSearch(query.search || undefined)
      .withCategory(query.categoryId)
      .withRequestedPriority(query.requestedPriority)
      .withItPriority(query.itPriority)
      .withStatus(query.currentStatus)
      .withStatusGroup(query.statusGroup)
      .reportedResolved(query.requesterReportedResolved)
      .withTicketOwner(query.ticketOwnerId)
      .unassignedOnly(query.unassignedOnly)
      .sortBy(query.sortBy, query.sortDir)
      .paginate(query.page, query.pageSize)
      .build()

    const [tickets, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          categoryId: true,
          requestedPriority: true,
          itPriority: true,
          currentStatus: true,
          ticketOwnerId: true,
          requesterResolvedAt: true,
          createdAt: true,
          updatedAt: true,
          requester: { select: { id: true, name: true } },
          ticketOwner: { select: { id: true, name: true } },
        },
        orderBy,
        skip,
        take,
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

// Role: REQ (own only), IT, ADM (any) -- api-spec.md §4. IT Staff/Admin have
// no UI to reach this yet (Issues 18/19), but the access rule is cheap and
// correct to implement alongside the Requester path now rather than redone
// later.
ticketsRouter.get('/:id', ...requireAnyAuthenticatedRole, async (request, response, next) => {
  try {
    const ticketId = parseId(request.params.id)
    const userId = response.locals.userId as number
    const role = response.locals.userRole as string

    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }

    if (role !== 'REQUESTER') {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          requester: { select: { id: true, name: true } },
          ticketOwner: { select: { id: true, name: true } },
        },
      })
      if (!ticket) {
        response.status(404).json({ error: 'TICKET_NOT_FOUND' })
        return
      }
      const facts = await loadActionFacts(prisma, ticketId)
      const blockers = evaluateResolutionGate(facts)
      // allowedStatuses and resolution are sent so the client never reimplements the state table or the gate.
      response.status(200).json({
        ...ticket,
        allowedStatuses: getTicketState(ticket.currentStatus).allowedActions(),
        actionsSummary: summarizeActions(facts),
        resolution: { canResolve: blockers.length === 0, blockers },
      })
      return
    }

    const result = await resolveOwnedTicket(ticketId, userId)
    if (result.status !== 'ok') {
      respondOwnershipFailure(response, result, { notFound: 'TICKET_NOT_FOUND', forbidden: 'TICKET_FORBIDDEN' })
      return
    }

    response.status(200).json({ ...result.value, actionsSummary: summarizeActions(await loadActionFacts(prisma, ticketId)) })
  } catch (error) {
    next(error)
  }
})
