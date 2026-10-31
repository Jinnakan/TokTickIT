import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ACTION_DESCRIPTION_MAX, ACTION_STATUS_LABELS, type ActionStatusValue } from '@toktickit/shared'
import { ActionApiError, SAVE_FAILED_MESSAGE } from '../../api/actions.js'
import type { AssignableUser } from '../../api/users.js'
import {
  buildPayload,
  initialValues,
  lockedFields,
  newRequestId,
  statusOptions,
  validateValues,
  type FieldKey,
  type FormMode,
  type FormValues,
} from '../../actions/action-form.js'

const FIELD_ID: Record<FieldKey, string> = {
  description: 'action-description',
  status: 'action-status',
  result: 'action-result',
  actionAt: 'action-at',
  assigneeId: 'action-assignee',
  followUpRequired: 'action-follow-up-required',
  followUpNote: 'action-follow-up-note',
  attachmentNotes: 'action-attachment-notes',
}
const FOCUS_ORDER: FieldKey[] = ['description', 'status', 'result', 'actionAt', 'assigneeId', 'followUpNote', 'attachmentNotes']

function FieldError({ field, message }: { field: FieldKey; message?: string }) {
  if (!message) return null
  return (
    <div id={`${FIELD_ID[field]}-error`} className="invalid-feedback d-block">
      {message}
    </div>
  )
}

export function ActionForm({
  mode,
  assignable,
  currentUserId,
  onSubmit,
  onCancel,
  onReload,
}: {
  mode: FormMode
  assignable: AssignableUser[] | 'error' | null
  currentUserId: number | undefined
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  onReload: () => void
}) {
  const [values, setValues] = useState<FormValues>(() => initialValues(mode, new Date(), currentUserId))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [isStale, setIsStale] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [focusTick, setFocusTick] = useState(0)
  const savingRef = useRef(false)
  const requestIdRef = useRef(newRequestId())
  const locked = lockedFields(mode)
  const isCreate = mode.kind === 'create'
  const presetCompleted = mode.kind === 'edit' && mode.presetStatus === 'COMPLETED'

  useEffect(() => {
    if (focusTick === 0) return
    const first = FOCUS_ORDER.find((key) => errors[key])
    if (first) document.getElementById(FIELD_ID[first])?.focus()
  }, [focusTick]) // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends FieldKey>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function describedBy(field: FieldKey, extra?: string): string | undefined {
    const ids = [errors[field] ? `${FIELD_ID[field]}-error` : '', extra ?? ''].filter(Boolean)
    return ids.length > 0 ? ids.join(' ') : undefined
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (savingRef.current) return

    const found = validateValues(mode, values, new Date())
    if (Object.keys(found).length > 0) {
      setErrors(found)
      setFormError('')
      setIsStale(false)
      setFocusTick((tick) => tick + 1)
      return
    }

    savingRef.current = true
    setIsSaving(true)
    setErrors({})
    setFormError('')
    setIsStale(false)
    try {
      await onSubmit(buildPayload(mode, values, requestIdRef.current))
    } catch (error) {
      if (error instanceof ActionApiError) {
        setErrors(error.fields)
        setFormError(error.code === 'VALIDATION_FAILED' ? 'Please fix the highlighted fields.' : error.message)
        setIsStale(error.code === 'STALE_UPDATE')
        if (Object.keys(error.fields).length > 0) setFocusTick((tick) => tick + 1)
      } else {
        setFormError(SAVE_FAILED_MESSAGE)
      }
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  const remaining = ACTION_DESCRIPTION_MAX - values.description.length
  const roClass = (key: FieldKey) => (locked.has(key) ? ' field-readonly' : '')

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate aria-label={isCreate ? 'Add action' : 'Edit action'} className="border rounded p-3 mb-3 bg-white">
      <h3 className="h6 fw-bold mb-3">{isCreate ? 'Add action' : 'Edit action'}</h3>

      {formError && (
        <div className="alert alert-danger d-flex flex-wrap align-items-center gap-2" role="alert">
          <span>{formError}</span>
          {isStale && (
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={onReload}>
              Reload
            </button>
          )}
        </div>
      )}

      {mode.kind === 'edit' && (
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <div className="form-label fw-semibold mb-1">Performed by</div>
            <div className="form-control field-readonly">{mode.action.createdByName}</div>
          </div>
          <div className="col-12 col-md-6">
            <div className="form-label fw-semibold mb-1">Created</div>
            <div className="form-control field-readonly">
              {new Date(mode.action.createdAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>
        </div>
      )}

      <div className="mb-3">
        <label htmlFor={FIELD_ID.description} className="form-label fw-semibold">Description *</label>
        <textarea
          id={FIELD_ID.description}
          className={`form-control${roClass('description')}${errors.description ? ' is-invalid' : ''}`}
          rows={3}
          value={values.description}
          readOnly={locked.has('description')}
          aria-readonly={locked.has('description') || undefined}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy('description', 'action-description-count')}
          onChange={(event) => set('description', event.target.value)}
        />
        <div id="action-description-count" className="form-text">
          {remaining >= 0 ? `${remaining} characters remaining` : `${-remaining} characters over the limit`}
        </div>
        <FieldError field="description" message={errors.description} />
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-md-6">
          <label htmlFor={FIELD_ID.status} className="form-label fw-semibold">Status</label>
          <select
            id={FIELD_ID.status}
            className={`form-select${roClass('status')}${errors.status ? ' is-invalid' : ''}`}
            value={values.status}
            disabled={locked.has('status')}
            aria-invalid={errors.status ? true : undefined}
            aria-describedby={describedBy('status')}
            onChange={(event) => set('status', event.target.value as ActionStatusValue)}
          >
            {statusOptions(mode).map((status) => (
              <option key={status} value={status}>{ACTION_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <FieldError field="status" message={errors.status} />
        </div>

        <div className="col-12 col-md-6">
          <label htmlFor={FIELD_ID.actionAt} className="form-label fw-semibold">Action date and time</label>
          <input
            id={FIELD_ID.actionAt}
            type="datetime-local"
            className={`form-control${roClass('actionAt')}${errors.actionAt ? ' is-invalid' : ''}`}
            value={values.actionAt}
            readOnly={locked.has('actionAt')}
            aria-readonly={locked.has('actionAt') || undefined}
            aria-invalid={errors.actionAt ? true : undefined}
            aria-describedby={describedBy('actionAt')}
            onChange={(event) => set('actionAt', event.target.value)}
          />
          <FieldError field="actionAt" message={errors.actionAt} />
        </div>
      </div>

      <div className="mb-3">
        <label htmlFor={FIELD_ID.result} className="form-label fw-semibold">
          Result{values.status === 'COMPLETED' ? ' *' : ''}
        </label>
        <textarea
          id={FIELD_ID.result}
          className={`form-control${roClass('result')}${errors.result ? ' is-invalid' : ''}`}
          rows={2}
          value={values.result}
          readOnly={locked.has('result')}
          aria-readonly={locked.has('result') || undefined}
          aria-invalid={errors.result ? true : undefined}
          aria-describedby={describedBy('result')}
          autoFocus={presetCompleted}
          onChange={(event) => set('result', event.target.value)}
        />
        <FieldError field="result" message={errors.result} />
      </div>

      <div className="mb-3">
        <label htmlFor={FIELD_ID.assigneeId} className="form-label fw-semibold">Assigned to</label>
        {assignable === 'error' ? (
          <p id="action-assignee-note" className="small text-danger mb-0">
            Unable to load the staff list. The action will be assigned to you.
          </p>
        ) : (
          <select
            id={FIELD_ID.assigneeId}
            className={`form-select${roClass('assigneeId')}${errors.assigneeId ? ' is-invalid' : ''}`}
            value={values.assigneeId}
            disabled={locked.has('assigneeId') || assignable === null}
            aria-invalid={errors.assigneeId ? true : undefined}
            aria-describedby={describedBy('assigneeId')}
            onChange={(event) => set('assigneeId', event.target.value)}
          >
            {assignable === null && <option value={values.assigneeId}>Loading staff…</option>}
            {(assignable ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}{user.role === 'ADMINISTRATOR' ? ' (Administrator)' : ''}
              </option>
            ))}
          </select>
        )}
        <FieldError field="assigneeId" message={errors.assigneeId} />
      </div>

      <div className="form-check mb-2">
        <input
          id={FIELD_ID.followUpRequired}
          type="checkbox"
          className="form-check-input"
          checked={values.followUpRequired}
          onChange={(event) => set('followUpRequired', event.target.checked)}
        />
        <label htmlFor={FIELD_ID.followUpRequired} className="form-check-label">Follow-up required</label>
      </div>

      {values.followUpRequired && (
        <div className="mb-3">
          <label htmlFor={FIELD_ID.followUpNote} className="form-label fw-semibold">Follow-up note *</label>
          <textarea
            id={FIELD_ID.followUpNote}
            className={`form-control${errors.followUpNote ? ' is-invalid' : ''}`}
            rows={2}
            value={values.followUpNote}
            aria-invalid={errors.followUpNote ? true : undefined}
            aria-describedby={describedBy('followUpNote')}
            onChange={(event) => set('followUpNote', event.target.value)}
          />
          <FieldError field="followUpNote" message={errors.followUpNote} />
        </div>
      )}

      <div className="mb-3">
        <label htmlFor={FIELD_ID.attachmentNotes} className="form-label fw-semibold">Attachment notes</label>
        <input
          id={FIELD_ID.attachmentNotes}
          type="text"
          className={`form-control${errors.attachmentNotes ? ' is-invalid' : ''}`}
          value={values.attachmentNotes}
          aria-invalid={errors.attachmentNotes ? true : undefined}
          aria-describedby={describedBy('attachmentNotes', 'action-attachment-help')}
          onChange={(event) => set('attachmentNotes', event.target.value)}
        />
        <div id="action-attachment-help" className="form-text">Which file to look at</div>
        <FieldError field="attachmentNotes" message={errors.attachmentNotes} />
      </div>

      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
