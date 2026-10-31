import type { Priority, TicketStatus } from '../types/ticket.js'

export type DrillDown = { view: 'my-tickets' | 'ticket-queue'; query: Record<string, string> } | null
export type Card = { key: string; label: string; count: number; drillDown: DrillDown }

export type RequesterDashboard = {
  generatedAt: string
  windowDays: number
  cards: Card[]
  recentlyUpdated: Array<{ id: number; ticketNumber: string; summary: string; currentStatus: TicketStatus; updatedAt: string }>
  recentlyResolved: Array<{ id: number; ticketNumber: string; summary: string; currentStatus: TicketStatus; resolvedAt: string }>
}

export type StaffDashboard = {
  generatedAt: string
  windowDays: number
  cards: Card[]
  byStatus: Array<{ status: TicketStatus; count: number; drillDown: DrillDown }>
  byItPriority: Array<{ priority: Priority; count: number; drillDown: DrillDown }>
  myActions: Array<{ actionId: number; ticketId: number; ticketNumber: string; description: string; status: string; actionAt: string }>
  recentlyUpdated: Array<{ id: number; ticketNumber: string; summary: string; currentStatus: TicketStatus; ticketOwnerName: string | null; updatedAt: string }>
  users?: { active: number; inactive: number; byRole: { REQUESTER: number; IT_STAFF: number; ADMINISTRATOR: number } }
}

async function load<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { credentials: 'include', signal })
  if (!response.ok) throw new Error('Unable to load the dashboard.')
  return response.json() as Promise<T>
}

export const fetchRequesterDashboard = (signal?: AbortSignal) => load<RequesterDashboard>('/api/dashboard/requester', signal)
export const fetchStaffDashboard = (signal?: AbortSignal) => load<StaffDashboard>('/api/dashboard/staff', signal)
