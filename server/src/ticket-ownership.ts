import type { Attachment, Ticket } from '@prisma/client'
import { prisma } from './prisma.js'
import type { OwnershipResult } from './authorization/ownership.js'

export type { OwnershipResult } from './authorization/ownership.js'
export { respondOwnershipFailure } from './authorization/ownership.js'

/**
 * Every Ticket/Attachment lookup in this app goes through one of these two
 * functions. Centralizing it means there is exactly one place that decides
 * "not found" vs "belongs to someone else" (404 vs 403, per api-spec.md §0/§4) —
 * a route handler can't accidentally leak ownership by rolling its own check.
 */
export async function resolveOwnedTicket(ticketId: number, requesterId: number): Promise<OwnershipResult<Ticket>> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return { status: 'not_found' }
  if (ticket.requesterId !== requesterId) return { status: 'forbidden' }
  return { status: 'ok', value: ticket }
}

export async function resolveOwnedAttachment(
  attachmentId: number,
  requesterId: number,
): Promise<OwnershipResult<Attachment>> {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { ticket: true },
  })
  if (!attachment) return { status: 'not_found' }
  if (attachment.ticket.requesterId !== requesterId) return { status: 'forbidden' }
  return { status: 'ok', value: attachment }
}
