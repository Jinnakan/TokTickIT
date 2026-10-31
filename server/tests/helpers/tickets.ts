import type { Priority, TicketStatus } from '@prisma/client'
import { prisma } from '../../src/prisma.js'
import type { AuthenticatedAgent } from './session.js'

export type CreatedTicket = { id: number; ticketNumber: string; currentStatus: string; version: number }

/** Creates a Ticket through the real API as the given Requester agent. */
export async function createTicketVia(agent: AuthenticatedAgent, summary = 'Helper ticket for tests'): Promise<CreatedTicket> {
  const [category, relatedSystem] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: 'asc' } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: 'asc' } }),
  ])
  const response = await agent.post('/api/tickets').send({
    categoryId: category.id,
    relatedSystemId: relatedSystem.id,
    requestedPriority: 'MEDIUM',
    summary,
    description: 'Ticket created by the test helper.',
  })
  if (response.status !== 201) {
    throw new Error(`createTicketVia failed: ${response.status} ${JSON.stringify(response.body)}`)
  }
  return response.body as CreatedTicket
}

/** Test-only shortcut: set a status directly (the workflow endpoint arrives in a later Issue). */
export async function setTicketStatus(ticketId: number, status: TicketStatus): Promise<void> {
  await prisma.ticket.update({ where: { id: ticketId }, data: { currentStatus: status } })
}

export async function versionOf(ticketId: number): Promise<number> {
  return (await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { version: true } })).version
}

/** Test-only: a Completed Action so the resolution gate lets a Ticket through. */
export async function addActionRow(
  ticketId: number,
  staffId: number,
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
  extra: { followUpRequired?: boolean; followUpNote?: string; followUpDoneAt?: Date } = {},
) {
  return prisma.actionTaken.create({
    data: {
      ticketId,
      createdById: staffId,
      assigneeId: staffId,
      actionAt: new Date(),
      description: `seeded ${status} action`,
      status,
      result: status === 'COMPLETED' ? 'Done.' : null,
      followUpNote: extra.followUpRequired ? (extra.followUpNote ?? 'Check later.') : null,
      ...extra,
    },
  })
}

let rowCounter = 0

/** Test-only: a Ticket row written straight to the database, with optional history rows. */
export async function createTicketRow(input: {
  requesterId: number
  status?: TicketStatus
  ownerId?: number | null
  itPriority?: Priority
  updatedAt?: Date
  requesterResolvedAt?: Date | null
  history?: Array<{ from: TicketStatus | null; to: TicketStatus; at: Date }>
}) {
  rowCounter += 1
  const [category, relatedSystem] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: 'asc' } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: 'asc' } }),
  ])
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TEST-DASH-${Date.now()}-${process.pid}-${rowCounter}`,
      requesterId: input.requesterId,
      ticketOwnerId: input.ownerId ?? null,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: `Dashboard test ticket ${rowCounter}`,
      description: 'Row created directly for a dashboard or filter test.',
      requestedPriority: 'MEDIUM',
      itPriority: input.itPriority ?? 'MEDIUM',
      currentStatus: input.status ?? 'NEW',
      requesterResolvedAt: input.requesterResolvedAt ?? null,
      ...(input.updatedAt ? { updatedAt: input.updatedAt } : {}),
    },
  })
  for (const row of input.history ?? []) {
    await prisma.ticketStatusHistory.create({
      data: { ticketId: ticket.id, fromStatus: row.from, toStatus: row.to, changedAt: row.at },
    })
  }
  return ticket
}
