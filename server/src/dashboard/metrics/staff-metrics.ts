import type { Priority, Role, TicketStatus } from '@prisma/client'
import { ACTIVE_STATUSES, PRIORITIES, TICKET_STATUSES } from '@toktickit/shared'
import { LIST_SIZE, type Card, type DashboardContext, type DrillDown, type Metric } from '../metric.js'

const ACTIVE = { currentStatus: { in: [...ACTIVE_STATUSES] as TicketStatus[] } }
const OPEN_ACTION_STATUSES = ['PLANNED', 'IN_PROGRESS'] as const
const queue = (query: Record<string, string>): DrillDown => ({ view: 'ticket-queue', query })

/** BR-L4-18: Unassigned, Owned by me, Reported resolved (all active Tickets), and My open actions. */
export class StaffCardsMetric implements Metric<Card[]> {
  readonly key = 'cards'

  async compute({ db, userId }: DashboardContext): Promise<Card[]> {
    const [unassigned, mine, reported, myOpenActions] = await Promise.all([
      db.ticket.count({ where: { ...ACTIVE, ticketOwnerId: null } }),
      db.ticket.count({ where: { ...ACTIVE, ticketOwnerId: userId } }),
      db.ticket.count({ where: { ...ACTIVE, requesterResolvedAt: { not: null } } }),
      db.actionTaken.count({ where: { assigneeId: userId, status: { in: [...OPEN_ACTION_STATUSES] } } }),
    ])
    return [
      { key: 'unassigned', label: 'Unassigned', count: unassigned, drillDown: queue({ unassignedOnly: 'true', statusGroup: 'active' }) },
      { key: 'mine', label: 'Owned by me', count: mine, drillDown: queue({ ticketOwnerId: String(userId), statusGroup: 'active' }) },
      {
        key: 'reported-resolved',
        label: 'Reported resolved by Requester',
        count: reported,
        drillDown: queue({ requesterReportedResolved: 'true', statusGroup: 'active' }),
      },
      { key: 'my-open-actions', label: 'My open actions', count: myOpenActions, drillDown: null },
    ]
  }
}

export type StatusRow = { status: TicketStatus; count: number; drillDown: DrillDown }

/** All 8 statuses, zero counts included, over every Ticket. */
export class ByStatusMetric implements Metric<StatusRow[]> {
  readonly key = 'byStatus'

  async compute({ db }: DashboardContext): Promise<StatusRow[]> {
    const rows = await db.ticket.groupBy({ by: ['currentStatus'], _count: { _all: true } })
    return TICKET_STATUSES.map((status) => ({
      status,
      count: rows.find((row) => row.currentStatus === status)?._count._all ?? 0,
      drillDown: queue({ currentStatus: status }),
    }))
  }
}

export type PriorityRow = { priority: Priority; count: number; drillDown: DrillDown }

/** LOW, MEDIUM, HIGH over active Tickets. */
export class ByItPriorityMetric implements Metric<PriorityRow[]> {
  readonly key = 'byItPriority'

  async compute({ db }: DashboardContext): Promise<PriorityRow[]> {
    const rows = await db.ticket.groupBy({ by: ['itPriority'], where: ACTIVE, _count: { _all: true } })
    return PRIORITIES.map((priority) => ({
      priority,
      count: rows.find((row) => row.itPriority === priority)?._count._all ?? 0,
      drillDown: queue({ itPriority: priority, statusGroup: 'active' }),
    }))
  }
}

export type MyAction = {
  actionId: number
  ticketId: number
  ticketNumber: string
  description: string
  status: string
  actionAt: Date
}

/** The caller's Planned and In Progress Actions, soonest first, at most 5; description cut at 80 characters. */
export class MyActionsMetric implements Metric<MyAction[]> {
  readonly key = 'myActions'

  async compute({ db, userId }: DashboardContext): Promise<MyAction[]> {
    const rows = await db.actionTaken.findMany({
      where: { assigneeId: userId, status: { in: [...OPEN_ACTION_STATUSES] } },
      orderBy: [{ actionAt: 'asc' }, { id: 'asc' }],
      take: LIST_SIZE,
      select: { id: true, ticketId: true, description: true, status: true, actionAt: true, ticket: { select: { ticketNumber: true } } },
    })
    return rows.map((row) => ({
      actionId: row.id,
      ticketId: row.ticketId,
      ticketNumber: row.ticket.ticketNumber,
      description: row.description.slice(0, 80),
      status: row.status,
      actionAt: row.actionAt,
    }))
  }
}

export type StaffRecent = {
  id: number
  ticketNumber: string
  summary: string
  currentStatus: TicketStatus
  ticketOwnerName: string | null
  updatedAt: Date
}

export class StaffRecentlyUpdatedMetric implements Metric<StaffRecent[]> {
  readonly key = 'recentlyUpdated'

  async compute({ db }: DashboardContext): Promise<StaffRecent[]> {
    const rows = await db.ticket.findMany({
      where: ACTIVE,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: LIST_SIZE,
      select: { id: true, ticketNumber: true, summary: true, currentStatus: true, updatedAt: true, ticketOwner: { select: { name: true } } },
    })
    return rows.map(({ ticketOwner, ...rest }) => ({ ...rest, ticketOwnerName: ticketOwner?.name ?? null }))
  }
}

export type UserCounts = { active: number; inactive: number; byRole: Record<Role, number> }

/** Administrator only: active and inactive users, and every user counted by role. */
export class UserCountsMetric implements Metric<UserCounts> {
  readonly key = 'users'

  async compute({ db }: DashboardContext): Promise<UserCounts> {
    const rows = await db.user.groupBy({ by: ['role', 'isActive'], _count: { _all: true } })
    const sum = (predicate: (row: (typeof rows)[number]) => boolean) =>
      rows.filter(predicate).reduce((total, row) => total + row._count._all, 0)
    return {
      active: sum((row) => row.isActive),
      inactive: sum((row) => !row.isActive),
      byRole: {
        REQUESTER: sum((row) => row.role === 'REQUESTER'),
        IT_STAFF: sum((row) => row.role === 'IT_STAFF'),
        ADMINISTRATOR: sum((row) => row.role === 'ADMINISTRATOR'),
      },
    }
  }
}
