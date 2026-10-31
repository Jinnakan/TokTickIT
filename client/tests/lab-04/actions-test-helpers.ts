import { vi } from 'vitest'
import type { ActionTaken } from '../../src/api/actions.js'

export function makeAction(overrides: Partial<ActionTaken> = {}): ActionTaken {
  return {
    id: 1, ticketId: 42, version: 1, actionAt: '2026-10-30T07:00:00.000Z', description: 'Checked the docking station.',
    result: null, status: 'PLANNED', createdById: 9, createdByName: 'Alex Rivera', assigneeId: 9, assigneeName: 'Alex Rivera',
    followUpRequired: false, followUpNote: null, followUpDoneAt: null, attachmentNotes: null,
    createdAt: '2026-10-30T06:00:00.000Z', updatedAt: '2026-10-30T06:00:00.000Z', ...overrides,
  }
}

export const assignableUsers = [
  { id: 9, name: 'Alex Rivera', role: 'IT_STAFF' },
  { id: 10, name: 'Priya Nair', role: 'IT_STAFF' },
  { id: 20, name: 'Morgan Kim', role: 'ADMINISTRATOR' },
]

export type RecordedRequest = { url: string; method: string; body: Record<string, unknown> | null }

type StubOptions = {
  initial?: ActionTaken[]
  /** Called for each POST/PATCH; return a Response-like to override, or undefined for the default success. */
  writeOverride?: (request: RecordedRequest) => { status: number; body: unknown } | undefined
  assignableOk?: boolean
  listOk?: boolean
  /** When a writeOverride answers 409, also bump the stored version so a reload sees the fresh one. */
  bumpOnConflict?: boolean
}

/** A small stateful fake of the Actions API for component tests. */
export function stubActionsApi(options: StubOptions = {}) {
  let actions = [...(options.initial ?? [])]
  const requests: RecordedRequest[] = []
  let nextId = 100

  const fetchStub = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
    const reply = (status: number, json: unknown) =>
      ({ ok: status >= 200 && status < 300, status, json: async () => json }) as Response

    if (url === '/api/users/assignable') {
      return options.assignableOk === false ? reply(500, { error: 'INTERNAL_ERROR' }) : reply(200, assignableUsers)
    }
    if (url === '/api/tickets/42/actions' && method === 'GET') {
      return options.listOk === false ? reply(500, { error: 'INTERNAL_ERROR' }) : reply(200, actions)
    }
    if (url.startsWith('/api/tickets/42/actions')) {
      const request = { url, method, body }
      requests.push(request)
      const overridden = options.writeOverride?.(request)
      if (overridden) {
        if (overridden.status === 409 && options.bumpOnConflict) {
          const id = Number(url.split('/').pop())
          actions = actions.map((item) => (item.id === id ? { ...item, version: item.version + 1 } : item))
        }
        return reply(overridden.status, overridden.body)
      }

      if (method === 'POST') {
        const created = makeAction({
          id: nextId++, description: String(body?.description ?? ''), status: (body?.status as ActionTaken['status']) ?? 'PLANNED',
          result: (body?.result as string) || null, assigneeId: Number(body?.assigneeId ?? 9),
          followUpRequired: Boolean(body?.followUpRequired), followUpNote: (body?.followUpNote as string) ?? null,
        })
        actions = [...actions, created]
        return reply(201, created)
      }
      if (method === 'PATCH') {
        const id = Number(url.split('/').pop())
        const current = actions.find((item) => item.id === id)
        if (!current) return reply(404, { error: 'ACTION_NOT_FOUND' })
        const { version: _version, followUpDone, ...rest } = body ?? {}
        void _version
        const updated: ActionTaken = {
          ...current, ...(rest as Partial<ActionTaken>), version: current.version + 1,
          ...(followUpDone === true ? { followUpDoneAt: '2026-10-31T09:00:00.000Z' } : {}),
        }
        actions = actions.map((item) => (item.id === id ? updated : item))
        return reply(200, updated)
      }
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`)
  })

  return { fetchStub, requests, current: () => actions }
}
