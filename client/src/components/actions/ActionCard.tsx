import { useState } from 'react'
import type { ActionTaken } from '../../api/actions.js'
import { ActionStatusBadge } from '../common/TicketBadges.js'
import { formatDateTime as formatDate } from '../../lib/format.js'

export function ActionCard({
  action,
  canChange,
  busy,
  onEdit,
  onStart,
  onComplete,
  onCancelAction,
  onMarkFollowUpDone,
}: {
  action: ActionTaken
  canChange: boolean
  busy: boolean
  onEdit: () => void
  onStart: () => void
  onComplete: () => void
  onCancelAction: () => void
  onMarkFollowUpDone: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const isFinal = action.status === 'CANCELLED'
  const followUpOpen = action.followUpRequired && action.followUpDoneAt === null && action.status !== 'CANCELLED'

  return (
    <li className="border rounded p-3 bg-white" aria-label={`Action: ${action.description.slice(0, 60)}`}>
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-1">
        <ActionStatusBadge status={action.status} />
        <span className="small text-body-secondary">{formatDate(action.actionAt)}</span>
      </div>
      <p className="mb-1" style={{ whiteSpace: 'pre-wrap' }}>{action.description}</p>
      {action.result && (
        <p className="mb-1" style={{ whiteSpace: 'pre-wrap' }}>
          <span className="fw-semibold">Result: </span>{action.result}
        </p>
      )}
      <p className="small text-body-secondary mb-1">
        Performed by {action.createdByName} · Assigned to {action.assigneeName}
      </p>
      {action.followUpRequired && (
        <p className="small mb-1">
          Follow-up needed: {action.followUpNote} ·{' '}
          <strong>{action.followUpDoneAt ? `Done ${formatDate(action.followUpDoneAt)}` : 'Open'}</strong>
        </p>
      )}
      {action.attachmentNotes && <p className="small mb-1">Attachment notes: {action.attachmentNotes}</p>}

      {canChange && !isFinal && !confirming && (
        <div className="d-flex flex-wrap gap-2 mt-2">
          {action.status === 'PLANNED' && (
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy} onClick={onStart}>Start</button>
          )}
          {(action.status === 'PLANNED' || action.status === 'IN_PROGRESS') && (
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy} onClick={onComplete}>Complete</button>
          )}
          {followUpOpen && (
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy} onClick={onMarkFollowUpDone}>
              Mark follow-up done
            </button>
          )}
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={onEdit}>Edit</button>
          {(action.status === 'PLANNED' || action.status === 'IN_PROGRESS') && (
            <button type="button" className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => setConfirming(true)}>
              Cancel action
            </button>
          )}
        </div>
      )}

      {confirming && (
        <div
          role="alertdialog"
          aria-labelledby={`confirm-cancel-${action.id}`}
          className="alert alert-warning mt-2 mb-0"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setConfirming(false)
          }}
        >
          <p id={`confirm-cancel-${action.id}`} className="mb-2">
            Cancel this action? It stays in the list as Cancelled and cannot be changed again.
          </p>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" autoFocus onClick={() => setConfirming(false)}>
              Keep action
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                setConfirming(false)
                onCancelAction()
              }}
            >
              Confirm cancel
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
