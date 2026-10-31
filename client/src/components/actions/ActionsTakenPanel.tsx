import { useEffect, useRef, useState } from 'react'
import {
  ActionApiError,
  createAction,
  fetchActions,
  updateAction,
  type ActionTaken,
} from '../../api/actions.js'
import { fetchAssignableUsers, type AssignableUser } from '../../api/users.js'
import type { FormMode } from '../../actions/action-form.js'
import type { TicketStatus } from '../../types/ticket.js'
import { ActionCard } from './ActionCard.js'
import { ActionForm } from './ActionForm.js'
import { useSingleFlight } from '../../lib/useSingleFlight.js'

const LOCKED_TICKET_STATUSES: readonly TicketStatus[] = ['CLOSED', 'CANCELLED']
const QUICK_SAVE_FAILED = 'Unable to save the action.'

function upsert(list: ActionTaken[], saved: ActionTaken): ActionTaken[] {
  const next = list.some((item) => item.id === saved.id)
    ? list.map((item) => (item.id === saved.id ? saved : item))
    : [...list, saved]
  return next.sort((a, b) => new Date(a.actionAt).getTime() - new Date(b.actionAt).getTime() || a.id - b.id)
}

export function ActionsTakenPanel({
  ticketId,
  ticketStatus,
  canEdit,
  currentUserId,
  ticketVersion,
  onChanged,
}: {
  ticketId: number
  ticketStatus: TicketStatus
  canEdit: boolean
  currentUserId?: number
  ticketVersion?: number
  onChanged?: () => void
}) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [actions, setActions] = useState<ActionTaken[]>([])
  const [mode, setMode] = useState<FormMode | null>(null)
  const [assignable, setAssignable] = useState<AssignableUser[] | 'error' | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [cardError, setCardError] = useState<{ text: string; stale: boolean } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const quickFlight = useSingleFlight()
  const [retryToken, setRetryToken] = useState(0)

  const firstVersion = useRef(ticketVersion)
  // A Cancel on the Ticket cancels Actions on the server, so the list follows the Ticket version quietly.
  useEffect(() => {
    if (ticketVersion === firstVersion.current) return
    firstVersion.current = ticketVersion
    fetchActions(ticketId).then(setActions).catch(() => {})
  }, [ticketVersion, ticketId])

  const ticketLocked = LOCKED_TICKET_STATUSES.includes(ticketStatus)
  const canChange = canEdit && !ticketLocked

  useEffect(() => {
    let ignore = false
    setLoadState('loading')
    fetchActions(ticketId)
      .then((loaded) => {
        if (ignore) return
        setActions(loaded)
        setLoadState('ready')
      })
      .catch(() => {
        if (!ignore) setLoadState('error')
      })
    return () => {
      ignore = true
    }
  }, [ticketId, retryToken])

  useEffect(() => {
    if (!mode || assignable !== null || !canChange) return
    let ignore = false
    fetchAssignableUsers()
      .then((users) => {
        if (!ignore) setAssignable(users)
      })
      .catch(() => {
        if (!ignore) setAssignable('error')
      })
    return () => {
      ignore = true
    }
  }, [mode, assignable, canChange])

  async function reload() {
    try {
      const loaded = await fetchActions(ticketId)
      setActions(loaded)
      setCardError(null)
      setMode((current) =>
        current && current.kind === 'edit'
          ? { ...current, action: loaded.find((item) => item.id === current.action.id) ?? current.action }
          : current,
      )
    } catch {
      setCardError({ text: 'Unable to reload the actions.', stale: false })
    }
  }

  async function submit(payload: Record<string, unknown>) {
    if (!mode) return
    const saved =
      mode.kind === 'create'
        ? await createAction(ticketId, payload)
        : await updateAction(ticketId, mode.action.id, payload)
    setActions((current) => upsert(current, saved))
    setMode(null)
    setCardError(null)
    setAnnouncement('Action saved')
    onChanged?.()
  }

  async function quickChange(action: ActionTaken, patch: Record<string, unknown>) {
    if (!quickFlight.begin()) return
    setBusyId(action.id)
    setCardError(null)
    try {
      const saved = await updateAction(ticketId, action.id, { version: action.version, ...patch })
      setActions((current) => upsert(current, saved))
      setAnnouncement('Action saved')
      onChanged?.()
    } catch (error) {
      setCardError({
        text: error instanceof ActionApiError ? error.message : QUICK_SAVE_FAILED,
        stale: error instanceof ActionApiError && error.code === 'STALE_UPDATE',
      })
    } finally {
      setBusyId(null)
      quickFlight.end()
    }
  }

  return (
    <section className="mt-4" aria-labelledby="actions-heading">
      <h2 id="actions-heading" className="h5 fw-bold mb-3">
        Actions Taken{loadState === 'ready' ? ` (${actions.length})` : ''}
      </h2>

      <p className="visually-hidden" role="status">{announcement}</p>

      {loadState === 'loading' && (
        <p className="status-message text-body-secondary" role="status">
          <span aria-hidden="true">⌛</span> Loading actions…
        </p>
      )}

      {loadState === 'error' && (
        <div className="alert alert-danger d-flex flex-wrap align-items-center gap-2" role="alert">
          <span>Unable to load the actions.</span>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setRetryToken((token) => token + 1)}>
            Retry
          </button>
        </div>
      )}

      {cardError && (
        <div className="alert alert-danger d-flex flex-wrap align-items-center gap-2" role="alert">
          <span>{cardError.text}</span>
          {cardError.stale && (
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void reload()}>
              Reload
            </button>
          )}
        </div>
      )}

      {loadState === 'ready' && actions.length === 0 && (
        <p className="text-body-secondary" role="status">No actions recorded yet.</p>
      )}

      {loadState === 'ready' && actions.length > 0 && (
        <ul className="list-unstyled d-flex flex-column gap-3 mb-3">
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              canChange={canChange && mode === null}
              busy={busyId === action.id}
              onEdit={() => setMode({ kind: 'edit', action })}
              onStart={() => void quickChange(action, { status: 'IN_PROGRESS' })}
              onComplete={() => setMode({ kind: 'edit', action, presetStatus: 'COMPLETED' })}
              onCancelAction={() => void quickChange(action, { status: 'CANCELLED' })}
              onMarkFollowUpDone={() => void quickChange(action, { followUpDone: true })}
            />
          ))}
        </ul>
      )}

      {canEdit && ticketLocked && (
        <p className="text-body-secondary">This ticket is closed, so actions can no longer be changed.</p>
      )}

      {mode && canChange && (
        <ActionForm
          key={mode.kind === 'create' ? 'create' : `edit-${mode.action.id}`}
          mode={mode}
          assignable={assignable}
          currentUserId={currentUserId}
          onSubmit={submit}
          onCancel={() => setMode(null)}
          onReload={() => void reload()}
        />
      )}

      {canChange && mode === null && loadState === 'ready' && (
        <button type="button" className="btn btn-primary" onClick={() => setMode({ kind: 'create' })}>
          Add action
        </button>
      )}
    </section>
  )
}
