import type { TicketStatus } from '@prisma/client'
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
