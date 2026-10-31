import { describe, expect, it } from 'vitest'
import {
  ACTION_STATUSES,
  allowedActionMoves,
  canMoveAction,
  evaluateActionEdit,
  parseActionBody,
  pickActionBody,
  type ActionDraft,
  type ActionStatusValue,
} from '@toktickit/shared'

const NOW = new Date('2026-10-31T10:00:00.000Z')
const existing: ActionDraft = {
  description: 'Checked the dock.',
  status: 'PLANNED',
  result: null,
  actionAt: new Date('2026-10-31T09:00:00.000Z'),
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
}

describe('Action field validation (ACT-U01, BR-L4-06, BR-L4-07)', () => {
  it('accepts a minimal create and applies defaults', () => {
    const { draft, fields } = parseActionBody({ description: '  Replaced the dock.  ' }, null, NOW)
    expect(fields).toEqual({})
    expect(draft).toMatchObject({
      description: 'Replaced the dock.',
      status: 'PLANNED',
      result: null,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
    })
    expect(draft.actionAt).toEqual(NOW)
  })

  it('requires a description of 1 to 2000 characters and accepts exactly 2000', () => {
    expect(parseActionBody({}, null, NOW).fields.description).toBe('Description must be 1-2000 characters.')
    expect(parseActionBody({ description: '   ' }, null, NOW).fields.description).toBe('Description must be 1-2000 characters.')
    expect(parseActionBody({ description: 'x'.repeat(2001) }, null, NOW).fields.description).toBe('Description must be 1-2000 characters.')
    expect(parseActionBody({ description: 'x'.repeat(2000) }, null, NOW).fields).toEqual({})
  })

  it('requires a result when Completed and limits it to 2000 characters', () => {
    expect(parseActionBody({ description: 'd', status: 'COMPLETED' }, null, NOW).fields.result).toBe(
      'Result is required when the action is completed.',
    )
    expect(parseActionBody({ description: 'd', status: 'COMPLETED', result: 'Done' }, null, NOW).fields).toEqual({})
    expect(parseActionBody({ description: 'd', result: 'x'.repeat(2001) }, null, NOW).fields.result).toBe(
      'Result must be at most 2000 characters.',
    )
  })

  it('stores an empty optional text as null', () => {
    const { draft } = parseActionBody({ description: 'd', result: '  ', attachmentNotes: '' }, null, NOW)
    expect(draft.result).toBeNull()
    expect(draft.attachmentNotes).toBeNull()
  })

  it('limits attachment notes to 500 characters', () => {
    expect(parseActionBody({ description: 'd', attachmentNotes: 'x'.repeat(501) }, null, NOW).fields.attachmentNotes).toBe(
      'Attachment notes must be at most 500 characters.',
    )
    expect(parseActionBody({ description: 'd', attachmentNotes: 'x'.repeat(500) }, null, NOW).fields).toEqual({})
  })

  it('pairs the follow-up note with followUpRequired', () => {
    expect(parseActionBody({ description: 'd', followUpRequired: true }, null, NOW).fields.followUpNote).toBe(
      'Follow-up note is required when follow-up is needed.',
    )
    expect(parseActionBody({ description: 'd', followUpNote: 'Later' }, null, NOW).fields.followUpNote).toBe(
      'Follow-up note must be empty when no follow-up is needed.',
    )
    expect(parseActionBody({ description: 'd', followUpRequired: true, followUpNote: 'x'.repeat(1001) }, null, NOW).fields.followUpNote).toBe(
      'Follow-up note must be at most 1000 characters.',
    )
    expect(parseActionBody({ description: 'd', followUpRequired: true, followUpNote: 'Check Friday' }, null, NOW).fields).toEqual({})
  })

  it('clears the note when follow-up is switched off without a new note', () => {
    const withFollowUp: ActionDraft = { ...existing, followUpRequired: true, followUpNote: 'Check Friday' }
    const { draft, fields } = parseActionBody({ followUpRequired: false }, withFollowUp, NOW)
    expect(fields).toEqual({})
    expect(draft.followUpNote).toBeNull()
  })

  it('rejects non-text, non-boolean and non-integer values', () => {
    const { fields } = parseActionBody(
      { description: 5, status: 'DONE', result: 7, followUpRequired: 'yes', assigneeId: '9', followUpDone: 1 },
      null,
      NOW,
    )
    expect(fields.description).toBe('Description must be 1-2000 characters.')
    expect(fields.status).toBe('Status is invalid.')
    expect(fields.result).toBe('Result must be text.')
    expect(fields.followUpRequired).toBe('Follow-up required must be true or false.')
    expect(fields.assigneeId).toBe('Assignee must be an active IT Staff or Administrator.')
    expect(fields.followUpDone).toBe('Follow-up done must be true or false.')
  })

  it('parses actionAt only as an ISO time with a UTC offset', () => {
    expect(parseActionBody({ description: 'd', actionAt: '2026-11-02T09:00:00Z' }, null, NOW).fields).toEqual({})
    expect(parseActionBody({ description: 'd', actionAt: '2026-11-02T09:00:00+07:00' }, null, NOW).fields).toEqual({})
    for (const bad of ['2026-11-02', '2026-11-02T09:00:00', 'tomorrow', 12345, '2026-13-45T00:00:00Z']) {
      expect(parseActionBody({ description: 'd', actionAt: bad }, null, NOW).fields.actionAt).toBe(
        'Action date and time must be an ISO time with a UTC offset.',
      )
    }
  })

  it('allows a Planned or In Progress action in the future but not a Completed one beyond one minute', () => {
    const future = '2026-11-30T09:00:00Z'
    expect(parseActionBody({ description: 'd', actionAt: future }, null, NOW).fields).toEqual({})
    expect(parseActionBody({ description: 'd', status: 'IN_PROGRESS', actionAt: future }, null, NOW).fields).toEqual({})
    expect(
      parseActionBody({ description: 'd', status: 'COMPLETED', result: 'r', actionAt: future }, null, NOW).fields.actionAt,
    ).toBe('A completed action cannot be dated in the future.')
    expect(
      parseActionBody({ description: 'd', status: 'COMPLETED', result: 'r', actionAt: '2026-10-31T10:00:30Z' }, null, NOW).fields,
    ).toEqual({})
  })

  it('lets a create start only as Planned, In Progress or Completed', () => {
    expect(parseActionBody({ description: 'd', status: 'CANCELLED' }, null, NOW).fields.status).toBe(
      'A new action can start as Planned, In Progress or Completed.',
    )
  })

  it('validates requestId only on create', () => {
    expect(parseActionBody({ description: 'd', requestId: 'abc' }, null, NOW).fields.requestId).toBe(
      'Request id must be 8-64 letters, digits, "-" or "_".',
    )
    expect(parseActionBody({ description: 'd', requestId: 'bad id!!!' }, null, NOW).fields.requestId).toBeDefined()
    expect(parseActionBody({ description: 'd', requestId: 'req-12345678' }, null, NOW).requestId).toBe('req-12345678')
    expect(parseActionBody({ requestId: 'abc' }, existing, NOW).fields).toEqual({})
  })

  it('merges a partial edit onto the existing action', () => {
    const { draft, fields } = parseActionBody({ result: 'Fixed', status: 'COMPLETED' }, existing, NOW)
    expect(fields).toEqual({})
    expect(draft).toMatchObject({ description: 'Checked the dock.', status: 'COMPLETED', result: 'Fixed' })
  })

  it('refuses followUpDone true when no follow-up is required', () => {
    expect(parseActionBody({ followUpDone: true }, existing, NOW).fields.followUpDone).toBe(
      'There is no follow-up to mark as done.',
    )
  })
})

describe('Action status moves and locks (ACT-U02, BR-L4-05)', () => {
  const allowed: Record<ActionStatusValue, ActionStatusValue[]> = {
    PLANNED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  }

  it('matches the BR-L4-05 table for every from/to pair', () => {
    for (const from of ACTION_STATUSES) {
      expect(allowedActionMoves(from)).toEqual(allowed[from])
      for (const to of ACTION_STATUSES) {
        expect(canMoveAction(from, to)).toBe(allowed[from].includes(to))
      }
    }
  })

  it('locks a Cancelled action against every edit', () => {
    expect(evaluateActionEdit('CANCELLED', {})).toEqual({ error: 'ACTION_LOCKED', reason: 'CANCELLED' })
    expect(evaluateActionEdit('CANCELLED', { followUpDone: true })).toEqual({ error: 'ACTION_LOCKED', reason: 'CANCELLED' })
  })

  it('lets a Completed action change only follow-up fields and attachment notes', () => {
    expect(evaluateActionEdit('COMPLETED', { followUpRequired: true, followUpNote: 'n', followUpDone: true, attachmentNotes: 'a' })).toBeNull()
    expect(evaluateActionEdit('COMPLETED', { description: 'x', result: 'y', actionAt: 'z', assigneeId: 1 })).toEqual({
      error: 'ACTION_LOCKED',
      reason: 'COMPLETED',
      fields: ['description', 'result', 'actionAt', 'assigneeId'],
    })
  })

  it('reports an illegal status move with from and to', () => {
    expect(evaluateActionEdit('COMPLETED', { status: 'PLANNED' })).toEqual({
      error: 'INVALID_ACTION_TRANSITION',
      from: 'COMPLETED',
      to: 'PLANNED',
    })
    expect(evaluateActionEdit('IN_PROGRESS', { status: 'PLANNED' })).toEqual({
      error: 'INVALID_ACTION_TRANSITION',
      from: 'IN_PROGRESS',
      to: 'PLANNED',
    })
  })

  it('treats the current status as no change and lets a legal move through', () => {
    expect(evaluateActionEdit('PLANNED', { status: 'PLANNED' })).toBeNull()
    expect(evaluateActionEdit('COMPLETED', { status: 'COMPLETED' })).toBeNull()
    expect(evaluateActionEdit('PLANNED', { status: 'IN_PROGRESS' })).toBeNull()
  })
})

describe('Body allowlist (ACT-U03, BR-L4-04)', () => {
  it('keeps only allowlisted fields and never copies protected ones', () => {
    const picked = pickActionBody({
      description: 'd',
      createdById: 99,
      ticketId: 98,
      id: 97,
      createdAt: 'x',
      bogus: true,
    })
    expect(picked).toEqual({ description: 'd' })
  })

  it('returns an empty object for a non-object body', () => {
    expect(pickActionBody(null)).toEqual({})
    expect(pickActionBody('text')).toEqual({})
    expect(pickActionBody([1, 2])).toEqual({})
  })

  it('does not copy protected fields into a parsed draft', () => {
    const { draft } = parseActionBody(pickActionBody({ description: 'd', createdById: 5, ticketId: 6, version: 7 }), null, NOW)
    expect(Object.keys(draft).sort()).toEqual(
      ['actionAt', 'attachmentNotes', 'description', 'followUpNote', 'followUpRequired', 'result', 'status'],
    )
  })
})
