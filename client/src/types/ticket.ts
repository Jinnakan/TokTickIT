export type Priority = 'LOW' | 'MEDIUM' | 'HIGH'
export type TicketStatus = 'NEW'

export type Ticket = {
  id: number
  ticketNumber: string
  requesterId: number
  categoryId: number
  relatedSystemId: number
  requestedPriority: Priority
  currentStatus: TicketStatus
  summary: string
  description: string
  createdAt: string
  updatedAt: string
}

export type CreateTicketInput = {
  categoryId: number
  relatedSystemId: number
  requestedPriority: Priority
  summary: string
  description: string
}

export type FieldErrors = Record<string, string>
