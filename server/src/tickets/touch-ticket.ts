import type { Prisma } from '@prisma/client'

/**
 * Child activity (an Action, Comment, Note, or Attachment change) counts as
 * activity on the Ticket (BR-L4-15), so "recently updated" reflects it.
 * Writes updatedAt explicitly because an empty Prisma update is not guaranteed to.
 */
export async function touchTicket(client: Pick<Prisma.TransactionClient, 'ticket'>, ticketId: number): Promise<void> {
  await client.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } })
}
