import { describe, expect, it } from 'vitest'
import { ACTION_STATUSES, type ActionStatusValue } from '@toktickit/shared'
import { evaluateResolutionGate, summarizeActions, type ActionFact } from '../../src/tickets/resolution-gate.js'
import { getTicketState } from '../../src/tickets/ticket-state/ticket-state-factory.js'

const DONE = new Date('2026-10-31T09:00:00.000Z')

function fact(status: ActionStatusValue, followUp: 'none' | 'open' | 'done' = 'none'): ActionFact {
  return { status, followUpRequired: followUp !== 'none', followUpDoneAt: followUp === 'done' ? DONE : null }
}

describe('Resolution gate (WF-U01, BR-L4-10)', () => {
  it('blocks a Ticket with no Actions at all (a legacy Ticket)', () => {
    expect(evaluateResolutionGate([])).toEqual([{ code: 'NO_COMPLETED_ACTION' }])
  })

  it('allows a Ticket with one Completed Action and nothing else', () => {
    expect(evaluateResolutionGate([fact('COMPLETED')])).toEqual([])
  })

  it('lists every blocker in the documented order with counts', () => {
    const blockers = evaluateResolutionGate([
      fact('PLANNED'),
      fact('IN_PROGRESS', 'open'),
      fact('CANCELLED'),
      fact('COMPLETED', 'open'),
    ])
    expect(blockers).toEqual([
      { code: 'ACTIONS_STILL_OPEN', count: 2 },
      { code: 'FOLLOW_UP_OPEN', count: 2 },
    ])
    expect(evaluateResolutionGate([fact('PLANNED')])).toEqual([
      { code: 'NO_COMPLETED_ACTION' },
      { code: 'ACTIONS_STILL_OPEN', count: 1 },
    ])
  })

  it('ignores a follow-up that is done and one on a Cancelled Action', () => {
    expect(evaluateResolutionGate([fact('COMPLETED', 'done'), fact('CANCELLED', 'open')])).toEqual([])
  })

  it('answers every combination of up to three Actions consistently with the rule', () => {
    const states: ActionFact[] = ACTION_STATUSES.flatMap((status) =>
      (['none', 'open', 'done'] as const).map((followUp) => fact(status, followUp)),
    )
    for (const a of states) for (const b of states) for (const c of [undefined, ...states]) {
      const actions = c ? [a, b, c] : [a, b]
      const blockers = evaluateResolutionGate(actions)
      const hasCompleted = actions.some((x) => x.status === 'COMPLETED')
      const open = actions.filter((x) => x.status === 'PLANNED' || x.status === 'IN_PROGRESS').length
      const followUps = actions.filter((x) => x.status !== 'CANCELLED' && x.followUpRequired && x.followUpDoneAt === null).length
      expect(blockers.some((x) => x.code === 'NO_COMPLETED_ACTION')).toBe(!hasCompleted)
      expect(blockers.find((x) => x.code === 'ACTIONS_STILL_OPEN')).toEqual(open > 0 ? { code: 'ACTIONS_STILL_OPEN', count: open } : undefined)
      expect(blockers.find((x) => x.code === 'FOLLOW_UP_OPEN')).toEqual(followUps > 0 ? { code: 'FOLLOW_UP_OPEN', count: followUps } : undefined)
    }
  })

  it('summarizes the Actions for GET /api/tickets/:id', () => {
    expect(
      summarizeActions([fact('PLANNED'), fact('IN_PROGRESS'), fact('COMPLETED', 'open'), fact('COMPLETED', 'done'), fact('CANCELLED', 'open')]),
    ).toEqual({ total: 5, planned: 1, inProgress: 1, completed: 2, cancelled: 1, openFollowUps: 1 })
    expect(summarizeActions([])).toEqual({ total: 0, planned: 0, inProgress: 0, completed: 0, cancelled: 0, openFollowUps: 0 })
  })
})

describe('Ticket transition matrix through the State classes (WF-U02, BR-L4-09)', () => {
  const expected = {
    NEW: ['OPEN', 'CANCELLED'],
    OPEN: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
    WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
    RESOLVED: ['CLOSED', 'REOPENED'],
    CLOSED: ['REOPENED'],
    REOPENED: ['IN_PROGRESS', 'CANCELLED'],
    CANCELLED: [],
  } as const

  it('matches the table exactly for every from/to pair', () => {
    const all = Object.keys(expected) as Array<keyof typeof expected>
    for (const from of all) {
      expect(getTicketState(from).allowedActions()).toEqual(expected[from])
      for (const to of all) {
        expect(getTicketState(from).canTransitionTo(to), `${from} -> ${to}`).toBe((expected[from] as readonly string[]).includes(to))
      }
    }
  })
})
