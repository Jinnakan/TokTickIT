import { describe, expect, it } from 'vitest'
import {
  buildPayload,
  initialValues,
  lockedFields,
  newRequestId,
  statusOptions,
  toLocalInput,
  validateValues,
  type FormMode,
} from '../../src/actions/action-form.js'
import type { ActionTaken } from '../../src/api/actions.js'

const NOW = new Date('2026-10-31T10:00:30.000Z')

function action(overrides: Partial<ActionTaken> = {}): ActionTaken {
  return {
    id: 5, ticketId: 42, version: 3, actionAt: '2026-10-31T08:00:00.000Z', description: 'Checked the dock.',
    result: null, status: 'PLANNED', createdById: 9, createdByName: 'Alex Rivera', assigneeId: 10, assigneeName: 'Priya Nair',
    followUpRequired: false, followUpNote: null, followUpDoneAt: null, attachmentNotes: null,
    createdAt: '2026-10-31T07:00:00.000Z', updatedAt: '2026-10-31T07:00:00.000Z', ...overrides,
  }
}

const create: FormMode = { kind: 'create' }

describe('initialValues', () => {
  it('defaults a new action to Planned, now (local, minutes), and the current user', () => {
    const values = initialValues(create, NOW, 9)
    expect(values).toMatchObject({ description: '', status: 'PLANNED', result: '', assigneeId: '9', followUpRequired: false })
    expect(values.actionAt).toBe(toLocalInput(NOW))
  })

  it('fills an edit from the action and honours a preset status', () => {
    const values = initialValues({ kind: 'edit', action: action({ result: 'r' }), presetStatus: 'COMPLETED' }, NOW, 9)
    expect(values).toMatchObject({ description: 'Checked the dock.', status: 'COMPLETED', result: 'r', assigneeId: '10' })
  })
})

describe('statusOptions and lockedFields (BR-L4-05)', () => {
  it('offers Planned, In Progress, Completed on create', () => {
    expect(statusOptions(create)).toEqual(['PLANNED', 'IN_PROGRESS', 'COMPLETED'])
  })

  it('offers the current status plus allowed moves on edit', () => {
    expect(statusOptions({ kind: 'edit', action: action({ status: 'PLANNED' }) })).toEqual(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    expect(statusOptions({ kind: 'edit', action: action({ status: 'IN_PROGRESS' }) })).toEqual(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    expect(statusOptions({ kind: 'edit', action: action({ status: 'COMPLETED' }) })).toEqual(['COMPLETED'])
  })

  it('locks everything except follow-up and attachment notes on a Completed action', () => {
    const locked = lockedFields({ kind: 'edit', action: action({ status: 'COMPLETED', result: 'r' }) })
    expect([...locked].sort()).toEqual(['actionAt', 'assigneeId', 'description', 'result', 'status'])
    expect(lockedFields(create).size).toBe(0)
    expect(lockedFields({ kind: 'edit', action: action() }).size).toBe(0)
  })
})

describe('buildPayload', () => {
  it('builds a create body with a trimmed text, ISO time, numeric assignee and the requestId', () => {
    const values = { ...initialValues(create, NOW, 9), description: '  Replaced the dock.  ', followUpRequired: true, followUpNote: ' Check Friday ' }
    const payload = buildPayload(create, values, 'act-12345678', NOW)
    expect(payload).toMatchObject({
      requestId: 'act-12345678',
      description: 'Replaced the dock.',
      status: 'PLANNED',
      assigneeId: 9,
      followUpRequired: true,
      followUpNote: 'Check Friday',
    })
    expect(typeof payload.actionAt).toBe('string')
    expect(payload.version).toBeUndefined()
  })

  it('omits assigneeId when none is chosen', () => {
    const values = { ...initialValues(create, NOW, undefined), description: 'x' }
    expect('assigneeId' in buildPayload(create, values, 'act-12345678', NOW)).toBe(false)
  })

  it('sends version and only changed or editable fields on edit', () => {
    const mode: FormMode = { kind: 'edit', action: action() }
    const values = { ...initialValues(mode, NOW, 9), description: 'Changed.' }
    const payload = buildPayload(mode, values, 'act-ignored1', NOW)
    expect(payload).toMatchObject({ version: 3, description: 'Changed.' })
    expect(payload.requestId).toBeUndefined()
    expect(payload.assigneeId).toBeUndefined()
    expect(payload.status).toBeUndefined()
    expect(payload.actionAt).toBeUndefined()
  })

  it('sends only follow-up fields and attachment notes for a Completed action', () => {
    const mode: FormMode = { kind: 'edit', action: action({ status: 'COMPLETED', result: 'Fixed.' }) }
    const values = { ...initialValues(mode, NOW, 9), followUpRequired: true, followUpNote: 'Later', attachmentNotes: 'photo.jpg' }
    const payload = buildPayload(mode, values, 'act-ignored1', NOW)
    expect(Object.keys(payload).sort()).toEqual(['attachmentNotes', 'followUpNote', 'followUpRequired', 'version'])
  })
})

describe('validateValues (uses the shared rules)', () => {
  it('returns the shared messages and the follow-up pairing rule', () => {
    const errors = validateValues(create, { ...initialValues(create, NOW, 9), followUpRequired: true }, NOW)
    expect(errors.description).toBe('Description must be 1-2000 characters.')
    expect(errors.followUpNote).toBe('Follow-up note is required when follow-up is needed.')
  })

  it('requires a result when Completed', () => {
    const values = { ...initialValues(create, NOW, 9), description: 'd', status: 'COMPLETED' as const }
    expect(validateValues(create, values, NOW).result).toBe('Result is required when the action is completed.')
  })

  it('requires an action date', () => {
    const values = { ...initialValues(create, NOW, 9), description: 'd', actionAt: '' }
    expect(validateValues(create, values, NOW).actionAt).toBe('Action date and time is required.')
  })

  it('passes a valid create', () => {
    expect(validateValues(create, { ...initialValues(create, NOW, 9), description: 'ok' }, NOW)).toEqual({})
  })
})

describe('newRequestId', () => {
  it('makes a safe, unique id', () => {
    const a = newRequestId()
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(newRequestId()).not.toBe(a)
  })
})
