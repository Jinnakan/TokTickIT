import { PRIORITY_LABELS, STATUS_LABELS } from '@toktickit/shared'
import type { Priority, TicketStatus } from '../types/ticket.js'

const PRIORITY_BADGE_CLASS: Record<Priority, string> = {
  LOW: 'bg-success-subtle text-success-emphasis',
  MEDIUM: 'bg-warning-subtle text-warning-emphasis',
  HIGH: 'bg-danger-subtle text-danger-emphasis',
}

// ui-spec.md §8 -- distinct color per status, never color alone (paired
// with STATUS_LABELS text below).
const STATUS_BADGE_CLASS: Record<TicketStatus, string> = {
  NEW: 'bg-success-subtle text-success-emphasis',
  OPEN: 'bg-primary-subtle text-primary-emphasis',
  IN_PROGRESS: 'bg-warning-subtle text-warning-emphasis',
  WAITING_FOR_REQUESTER: 'bg-info-subtle text-info-emphasis',
  RESOLVED: 'bg-success-subtle text-success-emphasis',
  CLOSED: 'bg-secondary-subtle text-secondary-emphasis',
  REOPENED: 'bg-danger-subtle text-danger-emphasis',
  CANCELLED: 'bg-secondary-subtle text-secondary-emphasis text-decoration-line-through',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge rounded-pill ${PRIORITY_BADGE_CLASS[priority]}`}>{PRIORITY_LABELS[priority]}</span>
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge rounded-pill ${STATUS_BADGE_CLASS[status]}`}>{STATUS_LABELS[status]}</span>
}
