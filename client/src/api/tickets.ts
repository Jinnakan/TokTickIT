import type { CreateTicketInput, FieldErrors, Ticket, TicketListQuery, TicketListResponse } from '../types/ticket.js'
import { devRequesterHeaders } from './http.js'

export class TicketValidationError extends Error {
  fields: FieldErrors

  constructor(fields: FieldErrors) {
    super('Ticket validation failed.')
    this.fields = fields
  }
}

export class TicketAccessError extends Error {
  status: 404 | 403

  constructor(status: 404 | 403) {
    super(status === 404 ? 'Ticket not found.' : 'This ticket belongs to a different Requester.')
    this.status = status
  }
}

export async function createTicket(input: CreateTicketInput, requesterId: number): Promise<Ticket> {
  const response = await fetch('/api/tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...devRequesterHeaders(requesterId),
    },
    body: JSON.stringify(input),
  })

  if (response.status === 400) {
    const body = await response.json() as { error: string; fields?: FieldErrors }
    if (body.error === 'VALIDATION_FAILED' && body.fields) {
      throw new TicketValidationError(body.fields)
    }
    throw new Error('Unable to create the ticket.')
  }

  if (!response.ok) {
    throw new Error('Unable to create the ticket.')
  }

  return response.json() as Promise<Ticket>
}

export async function fetchTickets(
  query: TicketListQuery,
  requesterId: number,
  signal?: AbortSignal,
): Promise<TicketListResponse> {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.categoryId !== undefined) params.set('categoryId', String(query.categoryId))
  if (query.requestedPriority) params.set('requestedPriority', query.requestedPriority)
  if (query.currentStatus) params.set('currentStatus', query.currentStatus)
  if (query.sortBy) params.set('sortBy', query.sortBy)
  if (query.sortDir) params.set('sortDir', query.sortDir)
  if (query.page !== undefined) params.set('page', String(query.page))

  const response = await fetch(`/api/tickets?${params.toString()}`, {
    headers: devRequesterHeaders(requesterId),
    signal,
  })

  if (!response.ok) {
    throw new Error('Unable to load tickets.')
  }

  return response.json() as Promise<TicketListResponse>
}

export async function fetchTicket(ticketId: number, requesterId: number, signal?: AbortSignal): Promise<Ticket> {
  const response = await fetch(`/api/tickets/${ticketId}`, {
    headers: devRequesterHeaders(requesterId),
    signal,
  })

  if (response.status === 404 || response.status === 403) {
    throw new TicketAccessError(response.status)
  }

  if (!response.ok) {
    throw new Error('Unable to load the ticket.')
  }

  return response.json() as Promise<Ticket>
}
