import type { StaffTicketListQuery, StaffTicketListResponse } from '../types/ticket.js'

export async function fetchStaffTicketQueue(
  query: StaffTicketListQuery,
  signal?: AbortSignal,
): Promise<StaffTicketListResponse> {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.categoryId !== undefined) params.set('categoryId', String(query.categoryId))
  if (query.requestedPriority) params.set('requestedPriority', query.requestedPriority)
  if (query.itPriority) params.set('itPriority', query.itPriority)
  if (query.currentStatus) params.set('currentStatus', query.currentStatus)
  if (query.ticketOwnerId !== undefined) params.set('ticketOwnerId', String(query.ticketOwnerId))
  if (query.unassignedOnly) params.set('unassignedOnly', 'true')
  if (query.sortBy) params.set('sortBy', query.sortBy)
  if (query.sortDir) params.set('sortDir', query.sortDir)
  if (query.page !== undefined) params.set('page', String(query.page))

  const response = await fetch(`/api/tickets?${params.toString()}`, {
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    throw new Error('Unable to load the ticket queue.')
  }

  return response.json() as Promise<StaffTicketListResponse>
}
