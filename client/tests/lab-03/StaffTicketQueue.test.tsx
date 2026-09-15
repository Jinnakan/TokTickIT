import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StaffTicketQueue } from '../../src/components/StaffTicketQueue.js'

const categories = [{ id: 1, name: 'Hardware' }]

const twoRequesterTickets = {
  data: [
    {
      id: 1,
      ticketNumber: 'TKT-2026-000001',
      summary: 'Laptop will not boot',
      categoryId: 1,
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
      currentStatus: 'NEW',
      ticketOwnerId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      requester: { id: 1, name: 'Jennifer Anderson' },
      ticketOwner: null,
    },
    {
      id: 2,
      ticketNumber: 'TKT-2026-000002',
      summary: 'VPN keeps disconnecting',
      categoryId: 1,
      requestedPriority: 'HIGH',
      itPriority: 'HIGH',
      currentStatus: 'OPEN',
      ticketOwnerId: 9,
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      requester: { id: 2, name: 'Sarah Johnson' },
      ticketOwner: { id: 9, name: 'Alex Rivera' },
    },
  ],
  meta: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 },
}

const relatedSystems = [{ id: 7, name: 'Corporate Laptop' }]

const ticketOneDetail = {
  ...twoRequesterTickets.data[0],
  description: 'The laptop will not power on at all.',
  allowedStatuses: ['OPEN', 'CANCELLED'],
}

function stubFetch(overrides: { onTicketsRequest?: (url: string) => void } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
    if (url === '/api/related-systems') return { ok: true, json: async () => relatedSystems } as Response
    if (url === '/api/tickets/1') return { ok: true, json: async () => ticketOneDetail } as Response
    if (url.startsWith('/api/tickets?')) {
      overrides.onTicketsRequest?.(url)
      return { ok: true, json: async () => twoRequesterTickets } as Response
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StaffTicketQueue', () => {
  // Desktop table and mobile card both render in the DOM at once
  // (CSS-hidden by breakpoint, per ui-spec.md) -- .findAllByText(...)[0] /
  // getAllByText(...)[0] pin these to the first (desktop) match, the same
  // pattern Lab 2's E2E spec uses for the same reason.

  it('renders tickets from multiple requesters, not scoped to one (UI-L3-05, AC-L3-09)', async () => {
    stubFetch()

    render(<StaffTicketQueue currentUserId={1} />)

    await waitFor(async () => {
      expect((await screen.findAllByText('Jennifer Anderson'))[0]).toBeInTheDocument()
    })
    expect(screen.getAllByText('Sarah Johnson')[0]).toBeInTheDocument()
    expect(screen.getAllByText('TKT-2026-000001')[0]).toBeInTheDocument()
    expect(screen.getAllByText('TKT-2026-000002')[0]).toBeInTheDocument()
  })

  it('re-requests with the correct query params when a filter changes (UI-L3-06)', async () => {
    let lastUrl = ''
    stubFetch({ onTicketsRequest: (url) => { lastUrl = url } })

    render(<StaffTicketQueue currentUserId={1} />)
    await screen.findAllByText('Jennifer Anderson')

    fireEvent.change(screen.getByLabelText('Filter by current status'), { target: { value: 'OPEN' } })

    await waitFor(() => {
      expect(lastUrl).toContain('currentStatus=OPEN')
    })
  })

  it('re-requests with unassignedOnly=true when the toggle is checked', async () => {
    let lastUrl = ''
    stubFetch({ onTicketsRequest: (url) => { lastUrl = url } })

    render(<StaffTicketQueue currentUserId={1} />)
    await screen.findAllByText('Jennifer Anderson')

    fireEvent.click(screen.getByLabelText('Unassigned only'))

    await waitFor(() => {
      expect(lastUrl).toContain('unassignedOnly=true')
    })
  })

  it('opens the real Staff Ticket Detail screen when a row is clicked', async () => {
    stubFetch()

    render(<StaffTicketQueue currentUserId={1} />)
    const [ticketCell] = await screen.findAllByText('TKT-2026-000001')

    fireEvent.click(ticketCell)

    expect(await screen.findByRole('heading', { name: /Ticket TKT-2026-000001/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Claim Ticket' })).toBeInTheDocument()
  })

  it('shows the empty state when the queue has no tickets', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
      if (url.startsWith('/api/tickets')) {
        return { ok: true, json: async () => ({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } }) } as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }))

    render(<StaffTicketQueue currentUserId={1} />)

    await waitFor(() => {
      expect(screen.getByText('No tickets in the queue yet.')).toBeInTheDocument()
    })
  })
})
