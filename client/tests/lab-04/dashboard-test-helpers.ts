export const requesterDashboard = {
  generatedAt: '2026-10-31T09:00:00.000Z',
  windowDays: 7,
  cards: [
    { key: 'open', label: 'Open tickets', count: 3, drillDown: { view: 'my-tickets', query: { statusGroup: 'active' } } },
    { key: 'in-progress', label: 'In progress', count: 1, drillDown: { view: 'my-tickets', query: { statusGroup: 'in-progress' } } },
    { key: 'waiting', label: 'Waiting for you', count: 1, drillDown: { view: 'my-tickets', query: { statusGroup: 'waiting' } } },
    { key: 'resolved', label: 'Resolved', count: 2, drillDown: { view: 'my-tickets', query: { statusGroup: 'resolved' } } },
  ],
  recentlyUpdated: [{ id: 42, ticketNumber: 'TKT-2026-000042', summary: 'Laptop battery drains quickly', currentStatus: 'OPEN', updatedAt: '2026-10-30T09:00:00.000Z' }],
  recentlyResolved: [{ id: 40, ticketNumber: 'TKT-2026-000040', summary: 'Docking station fixed', currentStatus: 'RESOLVED', resolvedAt: '2026-10-29T09:00:00.000Z' }],
}

export const emptyRequesterDashboard = {
  ...requesterDashboard,
  cards: requesterDashboard.cards.map((card) => ({ ...card, count: 0 })),
  recentlyUpdated: [],
  recentlyResolved: [],
}

const STATUSES = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED']

export function staffDashboard(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-10-31T09:00:00.000Z',
    windowDays: 7,
    cards: [
      { key: 'unassigned', label: 'Unassigned', count: 7, drillDown: { view: 'ticket-queue', query: { unassignedOnly: 'true', statusGroup: 'active' } } },
      { key: 'mine', label: 'Owned by me', count: 4, drillDown: { view: 'ticket-queue', query: { ticketOwnerId: '9', statusGroup: 'active' } } },
      { key: 'reported-resolved', label: 'Reported resolved by Requester', count: 2, drillDown: { view: 'ticket-queue', query: { requesterReportedResolved: 'true', statusGroup: 'active' } } },
      { key: 'my-open-actions', label: 'My open actions', count: 1, drillDown: null },
    ],
    byStatus: STATUSES.map((status, index) => ({ status, count: index, drillDown: { view: 'ticket-queue', query: { currentStatus: status } } })),
    byItPriority: ['LOW', 'MEDIUM', 'HIGH'].map((priority, index) => ({ priority, count: index + 1, drillDown: { view: 'ticket-queue', query: { itPriority: priority, statusGroup: 'active' } } })),
    myActions: [{ actionId: 31, ticketId: 42, ticketNumber: 'TKT-2026-000042', description: 'Replace the docking station firmware.', status: 'PLANNED', actionAt: '2026-10-31T10:00:00.000Z' }],
    recentlyUpdated: [{ id: 43, ticketNumber: 'TKT-2026-000043', summary: 'VPN keeps disconnecting', currentStatus: 'OPEN', ticketOwnerName: 'Alex Rivera', updatedAt: '2026-10-30T09:00:00.000Z' }],
    ...overrides,
  }
}

export const emptyStaffDashboard = staffDashboard({
  cards: staffDashboard().cards.map((card) => ({ ...card, count: 0 })),
  byStatus: STATUSES.map((status) => ({ status, count: 0, drillDown: { view: 'ticket-queue', query: { currentStatus: status } } })),
  byItPriority: ['LOW', 'MEDIUM', 'HIGH'].map((priority) => ({ priority, count: 0, drillDown: { view: 'ticket-queue', query: { itPriority: priority } } })),
  myActions: [],
  recentlyUpdated: [],
})
