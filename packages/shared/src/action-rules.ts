import type { FieldErrors } from './ticket-rules.js'

export const ACTION_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export type ActionStatusValue = (typeof ACTION_STATUSES)[number]

export const ACTION_CREATE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const

export const ACTION_STATUS_LABELS: Record<ActionStatusValue, string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const ACTION_DESCRIPTION_MAX = 2000
export const ACTION_RESULT_MAX = 2000
export const ACTION_FOLLOW_UP_NOTE_MAX = 1000
export const ACTION_ATTACHMENT_NOTES_MAX = 500
export const ACTION_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/
export const COMPLETED_FUTURE_SKEW_MS = 60_000
export const ASSIGNEE_ERROR_MESSAGE = 'Assignee must be an active IT Staff or Administrator.'

const NEXT_STATUSES: Record<ActionStatusValue, readonly ActionStatusValue[]> = {
  PLANNED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export function allowedActionMoves(from: ActionStatusValue): ActionStatusValue[] {
  return [...NEXT_STATUSES[from]]
}

export function canMoveAction(from: ActionStatusValue, to: ActionStatusValue): boolean {
  return NEXT_STATUSES[from].includes(to)
}

export const ACTION_BODY_FIELDS = [
  'description',
  'status',
  'result',
  'actionAt',
  'assigneeId',
  'followUpRequired',
  'followUpNote',
  'followUpDone',
  'attachmentNotes',
  'requestId',
  'version',
] as const
export type ActionBody = Partial<Record<(typeof ACTION_BODY_FIELDS)[number], unknown>>

/** Field allowlist (BR-L4-04): anything not listed, including createdById and ticketId, is dropped. */
export function pickActionBody(body: unknown): ActionBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return {}
  const source = body as Record<string, unknown>
  const picked: ActionBody = {}
  for (const field of ACTION_BODY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field) && source[field] !== undefined) {
      picked[field] = source[field]
    }
  }
  return picked
}

export type ActionDraft = {
  description: string
  status: ActionStatusValue
  result: string | null
  actionAt: Date
  followUpRequired: boolean
  followUpNote: string | null
  attachmentNotes: string | null
}

export type ParsedAction = {
  draft: ActionDraft
  assigneeId?: number
  followUpDone?: boolean
  requestId?: string
  fields: FieldErrors
}

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

function parseActionTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !ISO_WITH_OFFSET.test(value)) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

type TextRead = { present: boolean; value: string | null }

function readOptionalText(body: ActionBody, key: 'result' | 'followUpNote' | 'attachmentNotes', max: number, label: string, fields: FieldErrors): TextRead {
  if (!(key in body)) return { present: false, value: null }
  const raw = body[key]
  if (raw === null) return { present: true, value: null }
  if (typeof raw !== 'string') {
    fields[key] = `${label} must be text.`
    return { present: true, value: null }
  }
  const trimmed = raw.trim()
  if (trimmed.length > max) fields[key] = `${label} must be at most ${max} characters.`
  return { present: true, value: trimmed === '' ? null : trimmed }
}

/**
 * One parser for create (existing = null) and edit (existing = current row).
 * It validates the merged result, so an edit is checked as a whole. The caller
 * still does the database checks: assignee exists/active, Ticket locked, version.
 */
export function parseActionBody(body: ActionBody, existing: ActionDraft | null, now: Date): ParsedAction {
  const fields: FieldErrors = {}
  const base: ActionDraft = existing ?? {
    description: '',
    status: 'PLANNED',
    result: null,
    actionAt: now,
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
  }

  let description = base.description
  if ('description' in body) {
    description = typeof body.description === 'string' ? body.description.trim() : ''
  }
  if (description.length < 1 || description.length > ACTION_DESCRIPTION_MAX) {
    fields.description = `Description must be 1-${ACTION_DESCRIPTION_MAX} characters.`
  }

  let status = base.status
  if ('status' in body) {
    if (typeof body.status === 'string' && (ACTION_STATUSES as readonly string[]).includes(body.status)) {
      status = body.status as ActionStatusValue
    } else {
      fields.status = 'Status is invalid.'
    }
  }
  if (!existing && !fields.status && !(ACTION_CREATE_STATUSES as readonly string[]).includes(status)) {
    fields.status = 'A new action can start as Planned, In Progress or Completed.'
  }

  const resultRead = readOptionalText(body, 'result', ACTION_RESULT_MAX, 'Result', fields)
  const result = resultRead.present ? resultRead.value : base.result
  if (status === 'COMPLETED' && !fields.result && result === null) {
    fields.result = 'Result is required when the action is completed.'
  }

  let actionAt = base.actionAt
  if ('actionAt' in body) {
    const parsed = parseActionTime(body.actionAt)
    if (parsed) actionAt = parsed
    else fields.actionAt = 'Action date and time must be an ISO time with a UTC offset.'
  }
  if (status === 'COMPLETED' && !fields.actionAt && actionAt.getTime() > now.getTime() + COMPLETED_FUTURE_SKEW_MS) {
    fields.actionAt = 'A completed action cannot be dated in the future.'
  }

  let assigneeId: number | undefined
  if ('assigneeId' in body) {
    if (typeof body.assigneeId === 'number' && Number.isInteger(body.assigneeId)) assigneeId = body.assigneeId
    else fields.assigneeId = ASSIGNEE_ERROR_MESSAGE
  }

  let followUpRequired = base.followUpRequired
  if ('followUpRequired' in body) {
    if (typeof body.followUpRequired === 'boolean') followUpRequired = body.followUpRequired
    else fields.followUpRequired = 'Follow-up required must be true or false.'
  }
  const noteRead = readOptionalText(body, 'followUpNote', ACTION_FOLLOW_UP_NOTE_MAX, 'Follow-up note', fields)
  let followUpNote = noteRead.present ? noteRead.value : base.followUpNote
  if (!followUpRequired && 'followUpRequired' in body && !noteRead.present) followUpNote = null
  if (!fields.followUpNote) {
    if (followUpRequired && followUpNote === null) {
      fields.followUpNote = 'Follow-up note is required when follow-up is needed.'
    } else if (!followUpRequired && followUpNote !== null) {
      fields.followUpNote = 'Follow-up note must be empty when no follow-up is needed.'
    }
  }

  let followUpDone: boolean | undefined
  if ('followUpDone' in body) {
    if (typeof body.followUpDone === 'boolean') followUpDone = body.followUpDone
    else fields.followUpDone = 'Follow-up done must be true or false.'
  }
  if (followUpDone === true && !followUpRequired && !fields.followUpDone) {
    fields.followUpDone = 'There is no follow-up to mark as done.'
  }

  const notesRead = readOptionalText(body, 'attachmentNotes', ACTION_ATTACHMENT_NOTES_MAX, 'Attachment notes', fields)
  const attachmentNotes = notesRead.present ? notesRead.value : base.attachmentNotes

  let requestId: string | undefined
  if (!existing && 'requestId' in body) {
    if (typeof body.requestId === 'string' && ACTION_REQUEST_ID_PATTERN.test(body.requestId)) requestId = body.requestId
    else fields.requestId = 'Request id must be 8-64 letters, digits, "-" or "_".'
  }

  return {
    draft: { description, status, result, actionAt, followUpRequired, followUpNote, attachmentNotes },
    assigneeId,
    followUpDone,
    requestId,
    fields,
  }
}

/** Fields a Completed action may not change (BR-L4-05). Follow-up fields and attachment notes stay editable. */
export const COMPLETED_LOCKED_FIELDS = ['description', 'result', 'actionAt', 'assigneeId'] as const

export type ActionEditProblem =
  | { error: 'ACTION_LOCKED'; reason: 'CANCELLED' }
  | { error: 'ACTION_LOCKED'; reason: 'COMPLETED'; fields: string[] }
  | { error: 'INVALID_ACTION_TRANSITION'; from: ActionStatusValue; to: ActionStatusValue }

/** Returns null when the edit may go ahead, otherwise the 409 body to send. */
export function evaluateActionEdit(current: ActionStatusValue, body: ActionBody): ActionEditProblem | null {
  if (current === 'CANCELLED') return { error: 'ACTION_LOCKED', reason: 'CANCELLED' }

  if (current === 'COMPLETED') {
    const locked = COMPLETED_LOCKED_FIELDS.filter((field) => field in body)
    if (locked.length > 0) return { error: 'ACTION_LOCKED', reason: 'COMPLETED', fields: [...locked] }
  }

  const requested = body.status
  if (
    typeof requested === 'string' &&
    requested !== current &&
    (ACTION_STATUSES as readonly string[]).includes(requested) &&
    !canMoveAction(current, requested as ActionStatusValue)
  ) {
    return { error: 'INVALID_ACTION_TRANSITION', from: current, to: requested as ActionStatusValue }
  }

  return null
}
