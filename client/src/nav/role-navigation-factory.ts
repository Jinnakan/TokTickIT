import type { CurrentUser } from '../api/auth.js'

export type NavItem = {
  key: string
  label: string
}

const DASHBOARD: NavItem = { key: 'dashboard', label: 'Dashboard' }

const NAV_BY_ROLE: Record<CurrentUser['role'], NavItem[]> = {
  REQUESTER: [DASHBOARD, { key: 'my-tickets', label: 'My Tickets' }, { key: 'create-ticket', label: 'Create Ticket' }],
  IT_STAFF: [DASHBOARD, { key: 'ticket-queue', label: 'Ticket Queue' }],
  ADMINISTRATOR: [DASHBOARD, { key: 'ticket-queue', label: 'Ticket Queue' }, { key: 'user-management', label: 'User Management' }],
}

/**
 * Factory: replaces an if/else chain over role at every call site with one
 * lookup. Adding a role's nav only means editing this table, not hunting
 * down every place nav items get rendered.
 */
export function getNavItemsForRole(role: CurrentUser['role']): NavItem[] {
  return NAV_BY_ROLE[role] ?? []
}
