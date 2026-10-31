import { useEffect, useState } from 'react'
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS } from '@toktickit/shared'
import { claimTicket, reassignTicket, StaffTicketActionError, updateItPriority, updateStatus } from '../api/staffTicketDetail.js'
import { fetchAssignableUsers, type AssignableUser } from '../api/users.js'
import type { Priority, StaffTicketDetail, TicketStatus } from '../types/ticket.js'
import type { Blocker } from '../workflow/blockers.js'
import { ResolutionBlockers } from './ResolutionBlockers.js'
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
  const [assignable, setAssignable] = useState<AssignableUser[]>([])
  const [assignableFailed, setAssignableFailed] = useState(false)
  const [selectedOwner, setSelectedOwner] = useState('')
  const [isReassigning, setIsReassigning] = useState(false)
  const [blockedBy, setBlockedBy] = useState<Blocker[] | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchAssignableUsers(controller.signal)
      .then((users) => {
        setAssignable(users)
        setAssignableFailed(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setAssignableFailed(true)
      })
    return () => controller.abort()
  }, [])

  function clearFailure() {
    setActionError('')
    setIsStale(false)
    setBlockedBy(null)
  }

  function showFailure(error: unknown, fallback: string) {
    setActionError(error instanceof Error ? error.message : fallback)
    setIsStale(error instanceof StaffTicketActionError && error.code === 'STALE_UPDATE')
    const detail = error instanceof StaffTicketActionError ? (error.detail as { blockers?: Blocker[] } | undefined) : undefined
    const blocked = error instanceof StaffTicketActionError && error.code === 'RESOLUTION_BLOCKED'
    setBlockedBy(blocked ? (detail?.blockers ?? []) : null)
    // The standing resolution block is stale when the server says it is blocked.
    if (blocked) mediator.onStatusChanged()
  }

  async function handleReassign() {
    if (!selectedOwner) return
    clearFailure()
    setIsReassigning(true)
    try {
      await reassignTicket(ticket.id, Number(selectedOwner), ticket.version)
      setSelectedOwner('')
      mediator.onReassigned()
    } catch (error) {
      showFailure(error, 'Unable to reassign this ticket.')
    } finally {
      setIsReassigning(false)
    }
  }

  async function handleClaim() {
    clearFailure()
    setIsClaiming(true)
    try {
      await claimTicket(ticket.id)
      mediator.onClaimed()
    } catch (error) {
      showFailure(error, 'Unable to claim this ticket.')
    } finally {
      setIsClaiming(false)
    }
  }

  async function handlePriorityChange(next: Priority) {
    clearFailure()
    setIsChangingPriority(true)
    try {
      await updateItPriority(ticket.id, next, ticket.version)
      mediator.onPriorityChanged()
    } catch (error) {
      showFailure(error, 'Unable to update IT Priority.')
    } finally {
      setIsChangingPriority(false)
    }
  }

  async function handleStatusChange(next: TicketStatus) {
    clearFailure()
    setIsChangingStatus(true)
    try {
      await updateStatus(ticket.id, next, ticket.version)
      mediator.onStatusChanged()
    } catch (error) {
      showFailure(error, 'Unable to change the status.')
    } finally {
      setIsChangingStatus(false)
    }
  }

  const isOwnedByMe = ticket.ticketOwnerId === currentUserId

  return (
    <section className="mt-4" aria-labelledby="service-actions-heading">
      <h2 id="service-actions-heading" className="h5 fw-bold mb-3">Service Actions</h2>

      {actionError && (
        <div className="alert alert-danger d-flex flex-wrap align-items-center gap-2" role="alert">
          <span>{actionError}</span>
          {isStale && (
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => {
                clearFailure()
                mediator.onStatusChanged()
              }}>
              Reload
            </button>
          )}
        </div>
      )}

      <div className="row g-3 mb-2">
        <div className="col-12 col-sm-6 col-lg-4">
          <div className="form-label fw-semibold mb-1">Assigned To</div>
          {ticket.ticketOwner ? (
            <p className="mb-0">{ticket.ticketOwner.name}{isOwnedByMe ? ' (you)' : ''}</p>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleClaim()} disabled={isClaiming}>
              {isClaiming ? 'Claiming…' : 'Claim Ticket'}
            </button>
          )}

          <div className="mt-2">
            <label htmlFor="reassign-select" className="form-label small fw-semibold mb-1">
              {ticket.ticketOwner ? 'Reassign to' : 'Assign to'}
            </label>
            {assignableFailed ? (
              <p className="small text-danger mb-0">Unable to load the staff list. Reload to try again.</p>
            ) : (
              <div className="d-flex gap-2">
                <select
                  id="reassign-select"
                  className="form-select form-select-sm"
                  value={selectedOwner}
                  disabled={isReassigning}
                  onChange={(event) => setSelectedOwner(event.target.value)}
                >
                  <option value="">Choose staff…</option>
                  {assignable
                    .filter((user) => user.id !== ticket.ticketOwnerId)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}{user.role === 'ADMINISTRATOR' ? ' (Administrator)' : ''}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm text-nowrap"
                  disabled={!selectedOwner || isReassigning}
                  onClick={() => void handleReassign()}
                >
                  {isReassigning ? 'Saving…' : ticket.ticketOwner ? 'Reassign' : 'Assign'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-4">
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

        <div className="col-12 col-sm-6 col-lg-4">
          <label htmlFor="status-select" className="form-label fw-semibold">Current Status</label>
          <select
            id="status-select"
            className="form-select"
            value=""
            disabled={isChangingStatus || ticket.allowedStatuses.length === 0}
            onChange={(event) => {
              const next = event.target.value as TicketStatus
              if (!next) return
              if (next === 'CANCELLED') setConfirmingCancel(true)
              else void handleStatusChange(next)
            }}
          >
            <option value="" disabled>
              {STATUS_LABELS[ticket.currentStatus]} — change to…
            </option>
            {ticket.allowedStatuses.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status]}</option>
            ))}
          </select>
          {ticket.allowedStatuses.includes('RESOLVED') && !ticket.resolution.canResolve && (
            <ResolutionBlockers blockers={ticket.resolution.blockers} />
          )}
          {blockedBy && blockedBy.length > 0 && !(ticket.allowedStatuses.includes('RESOLVED') && !ticket.resolution.canResolve) && (
            <ResolutionBlockers blockers={blockedBy} />
          )}
          {confirmingCancel && (
            <div
              role="alertdialog"
              aria-labelledby="confirm-cancel-ticket"
              className="alert alert-warning mt-2 mb-0"
              onKeyDown={(event) => {
                if (event.key === 'Escape') setConfirmingCancel(false)
              }}
            >
              <p id="confirm-cancel-ticket" className="mb-2">
                Cancel this ticket? Its planned and in-progress actions will be cancelled too, and a cancelled ticket cannot be changed again.
              </p>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" autoFocus onClick={() => setConfirmingCancel(false)}>
                  Keep ticket
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    setConfirmingCancel(false)
                    void handleStatusChange('CANCELLED')
                  }}
                >
                  Cancel ticket
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
