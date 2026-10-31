import type { CurrentUser } from '../api/auth.js'
import { getNavItemsForRole } from './role-navigation-factory.js'

/** Query values from a dashboard drill-down (the same names GET /api/tickets accepts). */
export type ListFilters = Partial<
  Record<'statusGroup' | 'unassignedOnly' | 'ticketOwnerId' | 'requesterReportedResolved' | 'currentStatus' | 'itPriority', string>
>

export type Place = { key: string; filters: ListFilters }

export type NavState = {
  place: Place
  /** Changes on every `goto`, so a screen entered again starts fresh instead of keeping old state. */
  placeSeq: number
  openTicketId: number | null
  /** Bumped when a Ticket closes, so the screens kept underneath refetch. */
  listRefresh: number
}

export type NavAction =
  | { type: 'goto'; key: string; filters?: ListFilters }
  | { type: 'open'; ticketId: number }
  | { type: 'close' }

export function initialNavState(role: CurrentUser['role']): NavState {
  return {
    place: { key: getNavItemsForRole(role)[0]?.key ?? 'dashboard', filters: {} },
    placeSeq: 0,
    openTicketId: null,
    listRefresh: 0,
  }
}

export function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'goto':
      return { ...state, place: { key: action.key, filters: action.filters ?? {} }, placeSeq: state.placeSeq + 1, openTicketId: null }
    case 'open':
      return { ...state, openTicketId: action.ticketId }
    case 'close':
      return { ...state, openTicketId: null, listRefresh: state.listRefresh + 1 }
  }
}

const GROUP_LABELS: Record<string, string> = {
  active: 'Active tickets',
  'in-progress': 'In progress',
  waiting: 'Waiting for requester',
  resolved: 'Resolved',
}

/** The drill-down parts that have no control of their own on the list screens, as readable text. */
export function describeFilters(filters: { statusGroup?: string; ticketOwnerId?: string; requesterReportedResolved?: string }, currentUserId?: number): string[] {
  const parts: string[] = []
  if (filters.statusGroup) parts.push(GROUP_LABELS[filters.statusGroup] ?? filters.statusGroup)
  if (filters.ticketOwnerId) parts.push(Number(filters.ticketOwnerId) === currentUserId ? 'Owned by me' : `Owner ${filters.ticketOwnerId}`)
  if (filters.requesterReportedResolved) parts.push('Reported resolved by Requester')
  return parts
}
