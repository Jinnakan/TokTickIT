import type { TicketStatus } from '@prisma/client'
import { ACTIVE_STATUSES } from '@toktickit/shared'
import { LIST_SIZE, type Card, type DashboardContext, type Metric } from '../metric.js'

function total(rows: Array<{ currentStatus: TicketStatus; _count: { _all: number } }>, statuses: readonly string[]): number {
  return rows.filter((row) => statuses.includes(row.currentStatus)).reduce((sum, row) => sum + row._count._all, 0)
}

/** BR-L4-17: the four cards, from the Requester's own Tickets only. */
export class RequesterCardsMetric implements Metric<Card[]> {
  readonly key = 'cards'

  async compute({ db, userId }: DashboardContext): Promise<Card[]> {
    const rows = await db.ticket.groupBy({ by: ['currentStatus'], where: { requesterId: userId }, _count: { _all: true } })
    const card = (key: string, label: string, statuses: readonly string[], group: string): Card => ({
      key,
      label,
      count: total(rows, statuses),
      drillDown: { view: 'my-tickets', query: { statusGroup: group } },
    })
    return [
      card('open', 'Open tickets', ACTIVE_STATUSES, 'active'),
      card('in-progress', 'In progress', ['IN_PROGRESS'], 'in-progress'),
      card('waiting', 'Waiting for you', ['WAITING_FOR_REQUESTER'], 'waiting'),
      card('resolved', 'Resolved', ['RESOLVED'], 'resolved'),
    ]
  }
}

export type RecentTicket = { id: number; ticketNumber: string; summary: string; currentStatus: TicketStatus; updatedAt: Date }

export class RequesterRecentlyUpdatedMetric implements Metric<RecentTicket[]> {
  readonly key = 'recentlyUpdated'

  async compute({ db, userId }: DashboardContext): Promise<RecentTicket[]> {
    return db.ticket.findMany({
      where: { requesterId: userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: LIST_SIZE,
      select: { id: true, ticketNumber: true, summary: true, currentStatus: true, updatedAt: true },
    })
  }
}

export type ResolvedTicket = { id: number; ticketNumber: string; summary: string; currentStatus: TicketStatus; resolvedAt: Date }

/**
 * BR-L4-17: Tickets that are now Resolved or Closed and whose latest move to
 * Resolved is inside the window, dated from the status history. A Ticket
 * reopened later is no longer Resolved or Closed, so it drops out.
 */
export class RequesterRecentlyResolvedMetric implements Metric<ResolvedTicket[]> {
  readonly key = 'recentlyResolved'

  async compute({ db, userId, windowStart }: DashboardContext): Promise<ResolvedTicket[]> {
    const grouped = await db.ticketStatusHistory.groupBy({
      by: ['ticketId'],
      where: {
        toStatus: 'RESOLVED',
        changedAt: { gte: windowStart },
        ticket: { requesterId: userId, currentStatus: { in: ['RESOLVED', 'CLOSED'] } },
      },
      _max: { changedAt: true },
      orderBy: { _max: { changedAt: 'desc' } },
      take: LIST_SIZE,
    })
    if (grouped.length === 0) return []

    const tickets = await db.ticket.findMany({
      where: { id: { in: grouped.map((row) => row.ticketId) } },
      select: { id: true, ticketNumber: true, summary: true, currentStatus: true },
    })
    return grouped.flatMap((row) => {
      const ticket = tickets.find((candidate) => candidate.id === row.ticketId)
      return ticket && row._max.changedAt ? [{ ...ticket, resolvedAt: row._max.changedAt }] : []
    })
  }
}
