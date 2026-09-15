import type { Response } from 'express'
import type { Attachment, Ticket } from '@prisma/client'
import { prisma } from './prisma.js'

export type OwnershipResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'not_found' }
  | { status: 'forbidden' }

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

/** Writes the 404/403 response for a non-'ok' OwnershipResult. Never call this with 'ok'. */
export function respondOwnershipFailure(
  response: Response,
  result: { status: 'not_found' } | { status: 'forbidden' },
  errorCodes: { notFound: string; forbidden: string },
): void {
  if (result.status === 'not_found') {
    response.status(404).json({ error: errorCodes.notFound })
    return
  }
  response.status(403).json({ error: errorCodes.forbidden })
}
