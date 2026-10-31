import {
  ACTION_CREATE_STATUSES,
  allowedActionMoves,
  parseActionBody,
  pickActionBody,
  type ActionDraft,
  type ActionStatusValue,
} from '@toktickit/shared'
import type { ActionTaken } from '../api/actions.js'

export type FormMode =
  | { kind: 'create' }
  | { kind: 'edit'; action: ActionTaken; presetStatus?: ActionStatusValue }

export type FormValues = {
  description: string
  status: ActionStatusValue
  result: string
  actionAt: string
  assigneeId: string
  followUpRequired: boolean
  followUpNote: string
  attachmentNotes: string
}
export type FieldKey = keyof FormValues

const pad = (value: number) => String(value).padStart(2, '0')

/** Value for <input type="datetime-local">: local time, minutes precision. */
export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (value === '') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function newRequestId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  return `act-${random}`
}

export function initialValues(mode: FormMode, now: Date, currentUserId: number | undefined): FormValues {
  if (mode.kind === 'create') {
    return {
      description: '',
      status: 'PLANNED',
      result: '',
      actionAt: toLocalInput(now),
      assigneeId: currentUserId === undefined ? '' : String(currentUserId),
      followUpRequired: false,
      followUpNote: '',
      attachmentNotes: '',
    }
  }
  const { action } = mode
  return {
    description: action.description,
    status: mode.presetStatus ?? action.status,
    result: action.result ?? '',
    actionAt: toLocalInput(new Date(action.actionAt)),
    assigneeId: String(action.assigneeId),
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote ?? '',
    attachmentNotes: action.attachmentNotes ?? '',
  }
}

export function statusOptions(mode: FormMode): ActionStatusValue[] {
  if (mode.kind === 'create') return [...ACTION_CREATE_STATUSES]
  return [mode.action.status, ...allowedActionMoves(mode.action.status)]
}

const COMPLETED_LOCKED: readonly FieldKey[] = ['description', 'status', 'result', 'actionAt', 'assigneeId']

/** BR-L4-05: a Completed action may only change its follow-up fields and attachment notes. */
export function lockedFields(mode: FormMode): ReadonlySet<FieldKey> {
  if (mode.kind === 'edit' && mode.action.status === 'COMPLETED') return new Set(COMPLETED_LOCKED)
  return new Set()
}

export function buildPayload(
  mode: FormMode,
  values: FormValues,
  requestId: string,
  now: Date = new Date(),
): Record<string, unknown> {
  const followUp: Record<string, unknown> = { followUpRequired: values.followUpRequired }
  if (values.followUpRequired) followUp.followUpNote = values.followUpNote.trim()

  if (mode.kind === 'create') {
    const payload: Record<string, unknown> = {
      requestId,
      description: values.description.trim(),
      status: values.status,
      result: values.result.trim(),
      attachmentNotes: values.attachmentNotes.trim(),
      ...followUp,
    }
    const actionAt = fromLocalInput(values.actionAt)
    payload.actionAt = actionAt ?? values.actionAt
    if (values.assigneeId !== '') payload.assigneeId = Number(values.assigneeId)
    void now
    return payload
  }

  const { action } = mode
  const initial = initialValues({ kind: 'edit', action }, now, undefined)
  const payload: Record<string, unknown> = {
    version: action.version,
    attachmentNotes: values.attachmentNotes.trim(),
    ...followUp,
  }
  if (lockedFields(mode).size > 0) return payload

  payload.description = values.description.trim()
  payload.result = values.result.trim()
  if (values.status !== action.status) payload.status = values.status
  if (values.actionAt !== initial.actionAt) payload.actionAt = fromLocalInput(values.actionAt) ?? values.actionAt
  if (values.assigneeId !== '' && values.assigneeId !== initial.assigneeId) payload.assigneeId = Number(values.assigneeId)
  return payload
}

function toDraft(action: ActionTaken): ActionDraft {
  return {
    description: action.description,
    status: action.status,
    result: action.result,
    actionAt: new Date(action.actionAt),
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
  }
}

/** Same rules the server applies (shared package), so messages match before a round trip. */
export function validateValues(mode: FormMode, values: FormValues, now: Date): Record<string, string> {
  const { version: _version, requestId: _requestId, ...body } = buildPayload(mode, values, 'validate-only', now)
  void _version
  void _requestId
  const existing = mode.kind === 'edit' ? toDraft(mode.action) : null
  const errors: Record<string, string> = { ...parseActionBody(pickActionBody(body), existing, now).fields }
  if (!lockedFields(mode).has('actionAt') && fromLocalInput(values.actionAt) === null) {
    errors.actionAt = 'Action date and time is required.'
  }
  return errors
}
