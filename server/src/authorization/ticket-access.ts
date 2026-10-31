import type { Response } from 'express'
import { prisma } from '../prisma.js'
import { resolveOwnedTicket, respondOwnershipFailure } from '../ticket-ownership.js'

/**
 * The one access rule for every Ticket sub-resource a Requester may read:
 * a Requester must own the Ticket; IT Staff and Administrators can reach any
 * Ticket. Returns false, having already written the 403 or 404 response, when
 * access is refused, so callers just `if (!(await ...)) return`.
 */
export async function checkTicketAccess(
  ticketId: number,
  userId: number,
  role: string,
  response: Response,
): Promise<boolean> {
  if (role !== 'REQUESTER') {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } })
    if (!ticket) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return false
    }
    return true
  }

  const ownership = await resolveOwnedTicket(ticketId, userId)
  if (ownership.status !== 'ok') {
    respondOwnershipFailure(response, ownership, { notFound: 'TICKET_NOT_FOUND', forbidden: 'TICKET_FORBIDDEN' })
    return false
  }
  return true
}
