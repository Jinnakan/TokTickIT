import type {
  Priority as ServerPriority,
  TicketSortField,
  SortDirection,
  TicketStatusValue as ServerTicketStatus,
} from '@toktickit/shared'

export type Priority = ServerPriority
export type TicketStatus = ServerTicketStatus
export type { TicketSortField, SortDirection }

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

export type TicketListItem = Pick<
  Ticket,
  'id' | 'ticketNumber' | 'summary' | 'categoryId' | 'requestedPriority' | 'currentStatus' | 'createdAt' | 'updatedAt'
>

export type TicketListMeta = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export type TicketListResponse = {
  data: TicketListItem[]
  meta: TicketListMeta
}

export type TicketListQuery = {
  search?: string
  categoryId?: number
  requestedPriority?: Priority
  currentStatus?: TicketStatus
  sortBy?: TicketSortField
  sortDir?: SortDirection
  page?: number
}

export type CreateTicketInput = {
  categoryId: number
  relatedSystemId: number
  requestedPriority: Priority
  summary: string
  description: string
}

export type FieldErrors = Record<string, string>
