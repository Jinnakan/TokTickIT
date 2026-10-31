import type { TicketStatus } from '../types/ticket.js'

export type HistoryRow = {
  id: number
  fromStatus: TicketStatus | null
  toStatus: TicketStatus
  changedById: number | null
  changedByName: string | null
  changedAt: string
}

export async function fetchHistory(ticketId: number, signal?: AbortSignal): Promise<HistoryRow[]> {
  const response = await fetch(`/api/tickets/${ticketId}/history`, { credentials: 'include', signal })
  if (!response.ok) throw new Error('Unable to load the history.')
  return response.json() as Promise<HistoryRow[]>
}
