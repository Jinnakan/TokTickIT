import type { Prisma } from '@prisma/client'

export type LockedTicket = { id: number; currentStatus: string }

/**
 * BR-L4-11: lock the Ticket row for the rest of the transaction so two writes
 * on one Ticket run one after the other. Tagged template = bound parameter.
 */
export async function lockTicket(tx: Prisma.TransactionClient, ticketId: number): Promise<LockedTicket | null> {
  const rows = await tx.$queryRaw<LockedTicket[]>`
    SELECT id, "currentStatus"::text AS "currentStatus" FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`
  return rows[0] ?? null
}
