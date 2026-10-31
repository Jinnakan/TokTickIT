import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StaffTicketQueue } from '../../src/components/tickets/StaffTicketQueue.js'
import { StaffTicketDetail } from '../../src/components/tickets/StaffTicketDetail.js'
import { TicketDetail } from '../../src/components/tickets/TicketDetail.js'

const categories = [{ id: 1, name: 'Hardware' }]
const relatedSystems = [{ id: 7, name: 'Corporate Laptop' }]
const summary = { total: 0, planned: 0, inProgress: 0, completed: 0, cancelled: 0, openFollowUps: 0 }

function staffTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 42, ticketNumber: 'TKT-2026-000042', requesterId: 1, categoryId: 1, relatedSystemId: 7,
    requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', currentStatus: 'IN_PROGRESS', ticketOwnerId: 9,
    summary: 'Laptop battery drains quickly', description: 'The battery drains much faster than it used to.',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    requester: { id: 1, name: 'Jennifer Anderson' }, ticketOwner: { id: 9, name: 'Alex Rivera' },
    version: 4, requesterResolvedAt: null, allowedStatuses: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
    actionsSummary: summary, resolution: { canResolve: true, blockers: [] },
    ...overrides,
  }
}

type Options = {
  ticket?: Record<string, unknown>
  history?: unknown[]
  onStatus?: (body: Record<string, unknown>) => { status: number; body: unknown } | undefined
  onAppears?: () => { status: number; body: unknown }
}

function stubApi(options: Options = {}) {
  const writes: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = []
  let ticketReads = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const reply = (status: number, json: unknown) => ({ ok: status < 300, status, json: async () => json }) as Response
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null

    if (url === '/api/tickets/42' && method === 'GET') {
      ticketReads += 1
      return reply(200, options.ticket ?? staffTicket())
    }
    if (url === '/api/tickets/42/status' && method === 'PATCH') {
      writes.push({ url, method, body })
      const overridden = options.onStatus?.(body ?? {})
      return overridden ? reply(overridden.status, overridden.body) : reply(200, staffTicket({ version: 5 }))
    }
    if (url === '/api/tickets/42/appears-resolved' && method === 'POST') {
      writes.push({ url, method, body })
      const answer = options.onAppears?.() ?? { status: 200, body: { id: 42, requesterResolvedAt: '2026-10-31T09:00:00.000Z', currentStatus: 'IN_PROGRESS' } }
      return reply(answer.status, answer.body)
    }
    if (url === '/api/tickets/42/history') return reply(200, options.history ?? [])
    if (url === '/api/categories') return reply(200, categories)
    if (url === '/api/related-systems') return reply(200, relatedSystems)
    if (url === '/api/users/assignable') return reply(200, [])
    if (url.startsWith('/api/tickets/42/')) return reply(200, [])
    throw new Error(`Unexpected fetch: ${method} ${url}`)
  }))
  return { writes, ticketReads: () => ticketReads }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountStaff() {
  render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)
}

describe('Status control (UI4-17, FR-L4-06)', () => {
  it('offers only the next statuses the API sends', async () => {
    stubApi()
    mountStaff()
    const select = await screen.findByLabelText('Current Status')
    const labels = within(select).getAllByRole('option').map((option) => option.textContent)
    expect(labels).toEqual(['In Progress — change to…', 'Waiting for Requester', 'Resolved', 'Cancelled'])
  })

  it('sends the status with expectedVersion for an ordinary move', async () => {
    const api = stubApi()
    mountStaff()
    fireEvent.change(await screen.findByLabelText('Current Status'), { target: { value: 'WAITING_FOR_REQUESTER' } })
    await waitFor(() => expect(api.writes).toHaveLength(1))
    expect(api.writes[0].body).toEqual({ status: 'WAITING_FOR_REQUESTER', expectedVersion: 4 })
  })
})

describe('Blockers (UI4-18, AC-L4-12)', () => {
  const blocked = {
    canResolve: false,
    blockers: [{ code: 'NO_COMPLETED_ACTION' }, { code: 'ACTIONS_STILL_OPEN', count: 2 }, { code: 'FOLLOW_UP_OPEN', count: 1 }],
  }

  it('lists a plain-text line per blocker from the resolution block while Resolved is offered', async () => {
    stubApi({ ticket: staffTicket({ resolution: blocked }) })
    mountStaff()
    const list = await screen.findByRole('list', { name: 'Why this ticket cannot be resolved yet' })
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Add a completed action',
      '2 actions are still planned or in progress',
      '1 follow-up is still open',
    ])
  })

  it('shows the lines from the 409 when Resolved is chosen anyway', async () => {
    stubApi({
      onStatus: () => ({ status: 409, body: { error: 'RESOLUTION_BLOCKED', blockers: [{ code: 'ACTIONS_STILL_OPEN', count: 1 }] } }),
    })
    mountStaff()
    fireEvent.change(await screen.findByLabelText('Current Status'), { target: { value: 'RESOLVED' } })

    expect(await screen.findByText('This ticket cannot be resolved yet.')).toBeInTheDocument()
    expect(await screen.findByText('1 action is still planned or in progress')).toBeInTheDocument()
  })
})

describe('Cancel confirmation (UI4-19, AC-L4-19)', () => {
  it('asks first, names the open actions, and sends only after confirmation', async () => {
    const api = stubApi()
    mountStaff()
    fireEvent.change(await screen.findByLabelText('Current Status'), { target: { value: 'CANCELLED' } })

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(/planned and in-progress actions will be cancelled/)
    expect(api.writes).toHaveLength(0)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep ticket' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(api.writes).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Current Status'), { target: { value: 'CANCELLED' } })
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel ticket' }))
    await waitFor(() => expect(api.writes).toHaveLength(1))
    expect(api.writes[0].body).toEqual({ status: 'CANCELLED', expectedVersion: 4 })
  })
})

describe('Requester indication (UI4-20, AC-L4-16)', () => {
  const requesterTicket = {
    id: 42, ticketNumber: 'TKT-2026-000042', requesterId: 1, categoryId: 1, relatedSystemId: 7,
    requestedPriority: 'MEDIUM', currentStatus: 'IN_PROGRESS', summary: 'Laptop battery drains quickly',
    description: 'The battery drains much faster than it used to.', createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', version: 4, requesterResolvedAt: null, actionsSummary: summary,
  }

  it('shows the button, then the confirmation text, and never offers a status control', async () => {
    const api = stubApi({ ticket: requesterTicket })
    render(<TicketDetail ticketId={42} onBackToMyTickets={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Problem appears resolved' }))
    await waitFor(() => expect(api.writes).toHaveLength(1))
    expect(await screen.findByText(/You told us this appears resolved on/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Problem appears resolved' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Current Status')).not.toBeInTheDocument()
  })

  it('hides the button when the status does not apply, and shows the text when already used', async () => {
    stubApi({ ticket: { ...requesterTicket, currentStatus: 'NEW' } })
    const { unmount } = render(<TicketDetail ticketId={42} onBackToMyTickets={() => {}} />)
    await screen.findByText('Laptop battery drains quickly')
    expect(screen.queryByRole('button', { name: 'Problem appears resolved' })).not.toBeInTheDocument()
    unmount()
    vi.unstubAllGlobals()

    stubApi({ ticket: { ...requesterTicket, requesterResolvedAt: '2026-10-30T09:00:00.000Z' } })
    render(<TicketDetail ticketId={42} onBackToMyTickets={() => {}} />)
    expect(await screen.findByText(/You told us this appears resolved on/)).toBeInTheDocument()
  })

  it('shows staff the Requester reports resolved badge in the Ticket Detail header', async () => {
    stubApi({ ticket: staffTicket({ requesterResolvedAt: '2026-10-30T09:00:00.000Z' }) })
    mountStaff()
    expect(await screen.findByText('Requester reports resolved')).toBeInTheDocument()
  })

  it('shows no badge when nothing was reported', async () => {
    stubApi()
    mountStaff()
    await screen.findByText('Laptop battery drains quickly')
    expect(screen.queryByText('Requester reports resolved')).not.toBeInTheDocument()
  })
})

describe('History (UI4-21, AC-L4-18)', () => {
  it('is collapsed and lists the rows oldest first', async () => {
    stubApi({
      history: [
        { id: 1, fromStatus: null, toStatus: 'NEW', changedById: 1, changedByName: 'Jennifer Anderson', changedAt: '2026-10-30T07:00:00.000Z' },
        { id: 2, fromStatus: 'NEW', toStatus: 'OPEN', changedById: 9, changedByName: 'Alex Rivera', changedAt: '2026-10-30T08:00:00.000Z' },
      ],
    })
    mountStaff()
    const summaryElement = await screen.findByText('History')
    const details = summaryElement.closest('details') as HTMLDetailsElement
    expect(details.open).toBe(false)

    const rows = await within(details).findAllByRole('listitem', { hidden: true })
    expect(rows[0]).toHaveTextContent('Created as New')
    expect(rows[0]).toHaveTextContent('Jennifer Anderson')
    expect(rows[1]).toHaveTextContent('New → Open')
    expect(rows[1]).toHaveTextContent('Alex Rivera')
  })
})

describe('Stale update (UI4-22, AC-L4-08)', () => {
  it('shows the message with Reload and refetches without overwriting anything', async () => {
    const api = stubApi({ onStatus: () => ({ status: 409, body: { error: 'STALE_UPDATE', currentVersion: 6 } }) })
    mountStaff()
    fireEvent.change(await screen.findByLabelText('Current Status'), { target: { value: 'WAITING_FOR_REQUESTER' } })

    expect(await screen.findByText('This ticket changed since you opened it.')).toBeInTheDocument()
    const readsBefore = api.ticketReads()
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(api.ticketReads()).toBe(readsBefore + 1))
    expect(api.writes).toHaveLength(1)
    expect(screen.getByText('Laptop battery drains quickly')).toBeInTheDocument()
  })

  it('refreshes without the Loading ticket flash after a successful change', async () => {
    const api = stubApi()
    mountStaff()
    fireEvent.change(await screen.findByLabelText('Current Status'), { target: { value: 'WAITING_FOR_REQUESTER' } })
    await waitFor(() => expect(api.ticketReads()).toBe(2))
    expect(screen.queryByText(/Loading ticket/)).not.toBeInTheDocument()
    expect(screen.getByText('Laptop battery drains quickly')).toBeInTheDocument()
  })
})

describe('Queue indication (UI4-20, FR-L4-11)', () => {
  const row = (id: number, requesterResolvedAt: string | null) => ({
    id, ticketNumber: `TKT-2026-00000${id}`, summary: `Queue ticket ${id}`, categoryId: 1, requestedPriority: 'MEDIUM',
    itPriority: 'MEDIUM', currentStatus: 'IN_PROGRESS', ticketOwnerId: 9, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', requester: { id: 1, name: 'Jennifer Anderson' },
    ticketOwner: { id: 9, name: 'Alex Rivera' }, requesterResolvedAt,
  })

  it('shows the badge only on the row whose Requester reported it resolved', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const reply = (json: unknown) => ({ ok: true, status: 200, json: async () => json }) as Response
      if (url === '/api/categories') return reply(categories)
      if (url.startsWith('/api/tickets?')) {
        return reply({ data: [row(1, '2026-10-30T09:00:00.000Z'), row(2, null)], meta: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 } })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }))
    render(<StaffTicketQueue currentUserId={9} />)

    await screen.findAllByText('Queue ticket 1')
    expect(screen.getAllByText('Requester reports resolved').length).toBeGreaterThan(0)
    const rowOne = screen.getAllByText('Queue ticket 1')[0].closest('tr') as HTMLElement
    const rowTwo = screen.getAllByText('Queue ticket 2')[0].closest('tr') as HTMLElement
    expect(within(rowOne).getByText('Requester reports resolved')).toBeInTheDocument()
    expect(within(rowTwo).queryByText('Requester reports resolved')).not.toBeInTheDocument()
  })
})

describe('Reported-resolved badge is words with an outline, not a color alone (ST4-01)', () => {
  it('carries its text and a border so it reads without color', async () => {
    stubApi({ ticket: staffTicket({ requesterResolvedAt: '2026-10-30T09:00:00.000Z' }) })
    mountStaff()
    const badge = await screen.findByText('Requester reports resolved')
    expect(badge.className).toMatch(/border/)
  })
})
