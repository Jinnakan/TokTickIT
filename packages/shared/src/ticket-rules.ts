export const SUMMARY_MIN_LENGTH = 5
export const SUMMARY_MAX_LENGTH = 150
export const DESCRIPTION_MIN_LENGTH = 10
export const DESCRIPTION_MAX_LENGTH = 2000

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

export const TICKET_STATUSES = ['NEW'] as const
export type TicketStatusValue = (typeof TICKET_STATUSES)[number]

export const STATUS_LABELS: Record<TicketStatusValue, string> = {
  NEW: 'New',
}

export const TICKET_SORT_FIELDS = ['createdAt', 'ticketNumber', 'summary'] as const
export type TicketSortField = (typeof TICKET_SORT_FIELDS)[number]

export const SORT_DIRECTIONS = ['asc', 'desc'] as const
export type SortDirection = (typeof SORT_DIRECTIONS)[number]

export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 50

export type FieldErrors = Record<string, string>

export type TicketFieldInput = {
  categoryId: number | null
  relatedSystemId: number | null
  requestedPriority: string
  summary: string
  description: string
}

/**
 * Format-level ticket field validation, shared by the server (authoritative)
 * and the client (fast feedback before a round trip). Existence/active-state
 * checks for categoryId/relatedSystemId stay server-only since they require
 * a database lookup.
 */
export function validateTicketFields(input: TicketFieldInput): FieldErrors {
  const fields: FieldErrors = {}
  const summary = input.summary.trim()
  const description = input.description.trim()

  if (input.categoryId === null) {
    fields.categoryId = 'Category is required.'
  }
  if (input.relatedSystemId === null) {
    fields.relatedSystemId = 'Related System is required.'
  }
  if (!PRIORITIES.includes(input.requestedPriority as Priority)) {
    fields.requestedPriority = 'Requested Priority is required.'
  }
  if (summary.length < SUMMARY_MIN_LENGTH || summary.length > SUMMARY_MAX_LENGTH) {
    fields.summary = `Summary must be ${SUMMARY_MIN_LENGTH}-${SUMMARY_MAX_LENGTH} characters.`
  }
  if (description.length < DESCRIPTION_MIN_LENGTH || description.length > DESCRIPTION_MAX_LENGTH) {
    fields.description = `Description must be ${DESCRIPTION_MIN_LENGTH}-${DESCRIPTION_MAX_LENGTH} characters.`
  }

  return fields
}
