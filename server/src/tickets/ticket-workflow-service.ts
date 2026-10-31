import type { Prisma, Priority, Ticket, TicketStatus } from '@prisma/client'
import { PRIORITIES, TICKET_STATUSES, type FieldErrors } from '@toktickit/shared'
import { prisma } from '../prisma.js'
import { findAssignableUser } from '../users/assignable-roles.js'
import { lockTicket } from './lock-ticket.js'
import { evaluateResolutionGate, loadActionFacts } from './resolution-gate.js'
import { reply, validationFailed, type ServiceResult } from './service-result.js'
import { getTicketState } from './ticket-state/ticket-state-factory.js'

const APPEARS_RESOLVED_STATUSES: readonly TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED']
const VERSION_REQUIRED = 'expectedVersion is required.'
const OWNER_MESSAGE = 'ticketOwnerId must reference an active IT Staff or Administrator user.'

function readExpectedVersion(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null
}

/**
 * Every Ticket write that takes `expectedVersion` goes through here: lock the
 * row, 404 if it is gone, then 409 STALE_UPDATE if the caller's version is old.
 * Callers do their own 400 checks before this, so a bad body never takes a lock.
 */
async function lockedWrite(
  ticketId: number,
  expectedVersion: number,
  write: (tx: Prisma.TransactionClient, ticket: Ticket) => Promise<ServiceResult>,
): Promise<ServiceResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await lockTicket(tx, ticketId)
    if (!locked) return reply(404, { error: 'TICKET_NOT_FOUND' })

    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    if (ticket.version !== expectedVersion) {
      return reply(409, { error: 'STALE_UPDATE', currentVersion: ticket.version })
    }
    return write(tx, ticket)
  })
}

/** Claim is already an atomic check-and-set (Lab 3); it now also increases the version. */
export async function claim(ticketId: number, userId: number): Promise<ServiceResult> {
  const claimed = await prisma.ticket.updateMany({
    where: { id: ticketId, ticketOwnerId: null },
    data: { ticketOwnerId: userId, version: { increment: 1 } },
  })

  if (claimed.count === 0) {
    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!existing) return reply(404, { error: 'TICKET_NOT_FOUND' })
    return reply(409, { error: 'ALREADY_CLAIMED', ticketOwnerId: existing.ticketOwnerId })
  }
  return reply(200, await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } }))
}

export async function reassign(ticketId: number, rawOwnerId: unknown, rawVersion: unknown): Promise<ServiceResult> {
  const fields: FieldErrors = {}
  const ownerId = typeof rawOwnerId === 'number' && Number.isInteger(rawOwnerId) ? rawOwnerId : null
  if (ownerId === null) fields.ticketOwnerId = 'ticketOwnerId is required.'
  const expectedVersion = readExpectedVersion(rawVersion)
  if (expectedVersion === null) fields.expectedVersion = VERSION_REQUIRED
  if (Object.keys(fields).length > 0 || ownerId === null || expectedVersion === null) return validationFailed(fields)

  return lockedWrite(ticketId, expectedVersion, async (tx) => {
    if (!(await findAssignableUser(tx, ownerId))) return validationFailed({ ticketOwnerId: OWNER_MESSAGE })
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: { ticketOwnerId: ownerId, version: { increment: 1 } },
    })
    return reply(200, updated)
  })
}

export async function changePriority(ticketId: number, rawPriority: unknown, rawVersion: unknown): Promise<ServiceResult> {
  const fields: FieldErrors = {}
  const priority =
    typeof rawPriority === 'string' && (PRIORITIES as readonly string[]).includes(rawPriority) ? (rawPriority as Priority) : null
  if (priority === null) fields.itPriority = 'itPriority is invalid.'
  const expectedVersion = readExpectedVersion(rawVersion)
  if (expectedVersion === null) fields.expectedVersion = VERSION_REQUIRED
  if (Object.keys(fields).length > 0 || priority === null || expectedVersion === null) return validationFailed(fields)

  return lockedWrite(ticketId, expectedVersion, async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: { itPriority: priority, version: { increment: 1 } },
    })
    return reply(200, updated)
  })
}

/**
 * The status facade (FR-L4-06, FR-L4-07, BR-L4-09 to 16): one transaction does
 * lock, version check, transition check (State classes), resolution gate,
 * update, history row, and the Reopened / Cancelled side effects.
 */
export async function changeStatus(
  ticketId: number,
  actorId: number,
  rawStatus: unknown,
  rawVersion: unknown,
): Promise<ServiceResult> {
  const expectedVersion = readExpectedVersion(rawVersion)
  if (expectedVersion === null) return validationFailed({ expectedVersion: VERSION_REQUIRED })

  return lockedWrite(ticketId, expectedVersion, async (tx, ticket) => {
    const state = getTicketState(ticket.currentStatus)
    const requested =
      typeof rawStatus === 'string' && (TICKET_STATUSES as readonly string[]).includes(rawStatus)
        ? (rawStatus as TicketStatus)
        : null

    if (!requested || !state.canTransitionTo(requested)) {
      return reply(409, {
        error: 'INVALID_TRANSITION',
        from: ticket.currentStatus,
        to: typeof rawStatus === 'string' ? rawStatus : null,
        allowed: state.allowedActions(),
      })
    }

    if (requested === 'RESOLVED') {
      const blockers = evaluateResolutionGate(await loadActionFacts(tx, ticketId))
      if (blockers.length > 0) return reply(409, { error: 'RESOLUTION_BLOCKED', blockers })
    }

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        currentStatus: requested,
        version: { increment: 1 },
        ...(requested === 'REOPENED' ? { requesterResolvedAt: null } : {}),
      },
    })
    await tx.ticketStatusHistory.create({
      data: { ticketId, fromStatus: ticket.currentStatus, toStatus: requested, changedById: actorId },
    })
    if (requested === 'CANCELLED') {
      await tx.actionTaken.updateMany({
        where: { ticketId, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
        data: { status: 'CANCELLED', version: { increment: 1 } },
      })
    }
    return reply(200, updated)
  })
}

/** BR-L4-12: advisory only. Sets requesterResolvedAt once; never changes the status or version. */
export async function markAppearsResolved(ticketId: number): Promise<ServiceResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await lockTicket(tx, ticketId)
    if (!locked) return reply(404, { error: 'TICKET_NOT_FOUND' })

    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    if (!APPEARS_RESOLVED_STATUSES.includes(ticket.currentStatus)) {
      return reply(409, { error: 'NOT_APPLICABLE', currentStatus: ticket.currentStatus })
    }

    const requesterResolvedAt = ticket.requesterResolvedAt ?? new Date()
    if (ticket.requesterResolvedAt === null) {
      await tx.ticket.update({ where: { id: ticketId }, data: { requesterResolvedAt } })
    }
    return reply(200, { id: ticketId, requesterResolvedAt, currentStatus: ticket.currentStatus })
  })
}

export async function listHistory(ticketId: number): Promise<ServiceResult> {
  const rows = await prisma.ticketStatusHistory.findMany({
    where: { ticketId },
    orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
    include: { changedBy: { select: { name: true } } },
  })
  return reply(
    200,
    rows.map((row) => ({
      id: row.id,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      changedById: row.changedById,
      changedByName: row.changedBy?.name ?? null,
      changedAt: row.changedAt,
    })),
  )
}
