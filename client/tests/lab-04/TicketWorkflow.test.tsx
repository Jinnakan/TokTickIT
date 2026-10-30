import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TicketDetail } from '../../src/components/TicketDetail.js'
import { StaffTicketDetail } from '../../src/components/StaffTicketDetail.js'
import { StaffTicketQueue } from '../../src/components/StaffTicketQueue.js'

const categories = [{ id: 1, name: 'Hardware' }]
const relatedSystems = [{ id: 7, name: 'Corporate Laptop' }]

const requesterTicket = {
  id: 42,
  ticketNumber: 'TKT-2026-000042',
  requesterId: 1,
  categoryId: 1,
  relatedSystemId: 7,
  requestedPriority: 'MEDIUM',
  currentStatus: 'IN_PROGRESS',
  requesterResolvedAt: null as string | null,
  summary: 'Laptop battery drains quickly',
  description: 'The battery drains much faster than it used to.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const staffTicket = {
  ...requesterTicket,
  itPriority: 'MEDIUM',
  ticketOwnerId: 9,
  requester: { id: 1, name: 'Jennifer Anderson' },
  ticketOwner: { id: 9, name: 'Alex Rivera' },
  allowedStatuses: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
}

function stubFetch(ticket: Record<string, unknown>, onPost?: (url: string) => Record<string, unknown> | void) {
  const state = { ticket }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && url === '/api/tickets/42/appears-resolved') {
      const patch = onPost?.(url)
      if (patch) state.ticket = { ...state.ticket, ...patch }
      return { ok: true, status: 200, json: async () => ({ id: 42, ...patch }) } as Response
    }
    if (url === '/api/tickets/42') return { ok: true, status: 200, json: async () => state.ticket } as Response
    if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
    if (url === '/api/related-systems') return { ok: true, json: async () => relatedSystems } as Response
    if (url === '/api/tickets/42/attachments') return { ok: true, json: async () => [] } as Response
    if (url === '/api/tickets/42/comments') return { ok: true, json: async () => [] } as Response
    if (url === '/api/tickets/42/notes') return { ok: true, json: async () => [] } as Response
    if (url === '/api/users/assignable') return { ok: true, json: async () => [] } as Response
    throw new Error(`Unexpected fetch: ${url}`)
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Requester "Problem appears resolved" (UI4-19, AC-L4-15)', () => {
  it('offers the button on an active ticket and swaps it for confirmation text after use', async () => {
    stubFetch(requesterTicket, () => ({ requesterResolvedAt: '2026-01-05T10:00:00.000Z' }))

    render(<TicketDetail ticketId={42} onBackToMyTickets={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Problem appears resolved' }))

    expect(await screen.findByText(/You told us this appears resolved on/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Problem appears resolved' })).not.toBeInTheDocument()
    // The status shown is still the one IT Staff set; the indication is advisory.
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0)
  })

  it('sends exactly one request when the button is clicked repeatedly', async () => {
    let posts = 0
    stubFetch(requesterTicket, () => {
      posts += 1
      return { requesterResolvedAt: '2026-01-05T10:00:00.000Z' }
    })

    render(<TicketDetail ticketId={42} onBackToMyTickets={() => {}} />)

    const button = await screen.findByRole('button', { name: 'Problem appears resolved' })
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    await screen.findByText(/You told us this appears resolved on/)
    expect(posts).toBe(1)
  })

  it('shows only the confirmation text when the ticket already carries the indication', async () => {
    stubFetch({ ...requesterTicket, requesterResolvedAt: '2026-01-04T09:00:00.000Z' })

    render(<TicketDetail ticketId={42} onBackToMyTickets={() => {}} />)

    expect(await screen.findByText(/You told us this appears resolved on/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Problem appears resolved' })).not.toBeInTheDocument()
  })

  it('offers nothing on a New or Closed ticket', async () => {
    stubFetch({ ...requesterTicket, currentStatus: 'NEW' })
    const { unmount } = render(<TicketDetail ticketId={42} onBackToMyTickets={() => {}} />)
    await screen.findByText('Laptop battery drains quickly')
    expect(screen.queryByRole('button', { name: 'Problem appears resolved' })).not.toBeInTheDocument()
    unmount()

    stubFetch({ ...requesterTicket, currentStatus: 'CLOSED' })
    render(<TicketDetail ticketId={42} onBackToMyTickets={() => {}} />)
    await screen.findByText('Laptop battery drains quickly')
    expect(screen.queryByRole('button', { name: 'Problem appears resolved' })).not.toBeInTheDocument()
  })

  it('shows a safe message and keeps the button when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: false, status: 500, json: async () => ({ error: 'INTERNAL_ERROR' }) } as Response
      if (url === '/api/tickets/42') return { ok: true, status: 200, json: async () => requesterTicket } as Response
      if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
      if (url === '/api/related-systems') return { ok: true, json: async () => relatedSystems } as Response
      return { ok: true, json: async () => [] } as Response
    }))

    render(<TicketDetail ticketId={42} onBackToMyTickets={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Problem appears resolved' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to record/)
    expect(screen.getByRole('button', { name: 'Problem appears resolved' })).toBeEnabled()
  })
})

describe('Staff see the Requester indication (UI4-19, FR-L4-11)', () => {
  it('shows a "Requester reports resolved" badge on Ticket Detail only when it is set', async () => {
    stubFetch({ ...staffTicket, requesterResolvedAt: '2026-01-04T09:00:00.000Z' })
    const { unmount } = render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)
    expect(await screen.findByText('Requester reports resolved')).toBeInTheDocument()
    unmount()

    stubFetch(staffTicket)
    render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)
    await screen.findByText('Laptop battery drains quickly')
    expect(screen.queryByText('Requester reports resolved')).not.toBeInTheDocument()
  })

  it('shows the badge on the Ticket Queue row', async () => {
    const list = {
      data: [
        {
          id: 42, ticketNumber: 'TKT-2026-000042', summary: 'Laptop battery drains quickly', categoryId: 1,
          requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', currentStatus: 'IN_PROGRESS', ticketOwnerId: 9,
          requesterResolvedAt: '2026-01-04T09:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
          requester: { id: 1, name: 'Jennifer Anderson' }, ticketOwner: { id: 9, name: 'Alex Rivera' },
        },
      ],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/tickets?')) return { ok: true, json: async () => list } as Response
      if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
      throw new Error(`Unexpected fetch: ${url}`)
    }))

    render(<StaffTicketQueue currentUserId={9} />)

    await waitFor(() => {
      expect(screen.getAllByText('Requester reports resolved').length).toBeGreaterThan(0)
    })
  })
})
