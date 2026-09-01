import type { CreateTicketInput, FieldErrors, Ticket } from '../types/ticket.js'
import { devRequesterHeaders } from './http.js'

export class TicketValidationError extends Error {
  fields: FieldErrors

  constructor(fields: FieldErrors) {
    super('Ticket validation failed.')
    this.fields = fields
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
