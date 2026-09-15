import { useState } from 'react'
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS } from '@toktickit/shared'
import { claimTicket, updateItPriority, updateStatus } from '../api/staffTicketDetail.js'
import type { Priority, StaffTicketDetail, TicketStatus } from '../types/ticket.js'
import type { TicketDetailMediator } from '../staff/ticket-detail-mediator.js'

export function ServiceActionsPanel({
  ticket,
  currentUserId,
  mediator,
}: {
  ticket: StaffTicketDetail
  currentUserId: number
  mediator: TicketDetailMediator
}) {
  const [isClaiming, setIsClaiming] = useState(false)
  const [isChangingPriority, setIsChangingPriority] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [actionError, setActionError] = useState('')

  async function handleClaim() {
    setActionError('')
    setIsClaiming(true)
    try {
      await claimTicket(ticket.id)
      mediator.onClaimed()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to claim this ticket.')
    } finally {
      setIsClaiming(false)
    }
  }

  async function handlePriorityChange(next: Priority) {
    setActionError('')
    setIsChangingPriority(true)
    try {
      await updateItPriority(ticket.id, next)
      mediator.onPriorityChanged()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update IT Priority.')
    } finally {
      setIsChangingPriority(false)
    }
  }

  async function handleStatusChange(next: TicketStatus) {
    setActionError('')
    setIsChangingStatus(true)
    try {
      await updateStatus(ticket.id, next)
      mediator.onStatusChanged()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to change the status.')
    } finally {
      setIsChangingStatus(false)
    }
  }

  const isOwnedByMe = ticket.ticketOwnerId === currentUserId

  return (
    <section className="mt-4" aria-labelledby="service-actions-heading">
      <h2 id="service-actions-heading" className="h5 fw-bold mb-3">Service Actions</h2>

      {actionError && (
        <div className="alert alert-danger" role="alert">
          {actionError}
        </div>
      )}

      <div className="row g-3 mb-2">
        <div className="col-md-4">
          <div className="form-label fw-semibold mb-1">Assigned To</div>
          {ticket.ticketOwner ? (
            <p className="mb-0">{ticket.ticketOwner.name}{isOwnedByMe ? ' (you)' : ''}</p>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleClaim()} disabled={isClaiming}>
              {isClaiming ? 'Claiming…' : 'Claim Ticket'}
            </button>
          )}
        </div>

        <div className="col-md-4">
          <label htmlFor="it-priority-select" className="form-label fw-semibold">IT Priority</label>
          <select
            id="it-priority-select"
            className="form-select"
            value={ticket.itPriority}
            disabled={isChangingPriority}
            onChange={(event) => void handlePriorityChange(event.target.value as Priority)}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
            ))}
          </select>
        </div>

        <div className="col-md-4">
          <label htmlFor="status-select" className="form-label fw-semibold">Current Status</label>
          <select
            id="status-select"
            className="form-select"
            value=""
            disabled={isChangingStatus || ticket.allowedStatuses.length === 0}
            onChange={(event) => {
              if (event.target.value) void handleStatusChange(event.target.value as TicketStatus)
            }}
          >
            <option value="" disabled>
              {STATUS_LABELS[ticket.currentStatus]} — change to…
            </option>
            {ticket.allowedStatuses.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status]}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  )
}
