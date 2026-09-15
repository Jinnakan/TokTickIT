import { PRIORITY_LABELS, STATUS_LABELS } from '@toktickit/shared'
import type { Priority, TicketStatus } from '../types/ticket.js'

const PRIORITY_BADGE_CLASS: Record<Priority, string> = {
  LOW: 'bg-success-subtle text-success-emphasis',
  MEDIUM: 'bg-warning-subtle text-warning-emphasis',
  HIGH: 'bg-danger-subtle text-danger-emphasis',
}

const STATUS_BADGE_CLASS: Record<TicketStatus, string> = {
  NEW: 'bg-success-subtle text-success-emphasis',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge rounded-pill ${PRIORITY_BADGE_CLASS[priority]}`}>{PRIORITY_LABELS[priority]}</span>
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge rounded-pill ${STATUS_BADGE_CLASS[status]}`}>{STATUS_LABELS[status]}</span>
}
