import type { Priority, StaffTicketDetail, TicketStatus } from '../types/ticket.js'

export class StaffTicketActionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message)
  }
}

async function readError(response: Response): Promise<StaffTicketActionError> {
  const body = (await response.json().catch(() => ({}))) as { error?: string; [key: string]: unknown }
  return new StaffTicketActionError(body.error ?? 'UNKNOWN_ERROR', 'Request failed.', body)
}

export async function fetchStaffTicketDetail(ticketId: number, signal?: AbortSignal): Promise<StaffTicketDetail> {
  const response = await fetch(`/api/tickets/${ticketId}`, { credentials: 'include', signal })
  if (!response.ok) throw await readError(response)
  return response.json() as Promise<StaffTicketDetail>
}

export async function claimTicket(ticketId: number): Promise<StaffTicketDetail> {
  const response = await fetch(`/api/tickets/${ticketId}/claim`, { method: 'POST', credentials: 'include' })
  if (!response.ok) throw await readError(response)
  return response.json() as Promise<StaffTicketDetail>
}

export async function reassignTicket(ticketId: number, ticketOwnerId: number): Promise<StaffTicketDetail> {
  const response = await fetch(`/api/tickets/${ticketId}/reassign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ticketOwnerId }),
  })
  if (!response.ok) throw await readError(response)
  return response.json() as Promise<StaffTicketDetail>
}

export async function updateItPriority(ticketId: number, itPriority: Priority): Promise<StaffTicketDetail> {
  const response = await fetch(`/api/tickets/${ticketId}/priority`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ itPriority }),
  })
  if (!response.ok) throw await readError(response)
  return response.json() as Promise<StaffTicketDetail>
}

export async function updateStatus(ticketId: number, status: TicketStatus): Promise<StaffTicketDetail> {
  const response = await fetch(`/api/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  })
  if (!response.ok) throw await readError(response)
  return response.json() as Promise<StaffTicketDetail>
}
