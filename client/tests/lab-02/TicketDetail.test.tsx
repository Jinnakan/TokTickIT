import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TicketDetail } from '../../src/components/TicketDetail.js'

const categories = [{ id: 1, name: 'Hardware' }]
const relatedSystems = [{ id: 7, name: 'Corporate Laptop' }]

const ticket = {
  id: 42,
  ticketNumber: 'TKT-2026-000042',
  requesterId: 1,
  categoryId: 1,
  relatedSystemId: 7,
  requestedPriority: 'MEDIUM',
  currentStatus: 'NEW',
  summary: 'Laptop battery drains quickly',
  description: 'The battery drains much faster than it used to.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function stubFetch(overrides: { ticketStatus?: number; ticketBody?: unknown } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/tickets/42') {
      return { status: overrides.ticketStatus ?? 200, ok: (overrides.ticketStatus ?? 200) < 300, json: async () => overrides.ticketBody ?? ticket } as Response
    }
    if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
    if (url === '/api/related-systems') return { ok: true, json: async () => relatedSystems } as Response
    if (url === '/api/tickets/42/attachments') return { ok: true, json: async () => [] } as Response
    throw new Error(`Unexpected fetch: ${url}`)
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TicketDetail', () => {
  it('renders ticket fields as read-only with no comment/status controls (AC-12)', async () => {
    stubFetch()

    render(<TicketDetail ticketId={42} requesterId={1} onBackToMyTickets={() => {}} />)

    expect(await screen.findByText('TKT-2026-000042')).toBeInTheDocument()
    expect(screen.getByText('Laptop battery drains quickly')).toBeInTheDocument()
    expect(screen.getByText('Hardware')).toBeInTheDocument()
    expect(screen.getByText('Corporate Laptop')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /comment/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/internal note/i)).not.toBeInTheDocument()
  })

  it('shows a not-found state for an unknown ticket', async () => {
    stubFetch({ ticketStatus: 404, ticketBody: { error: 'TICKET_NOT_FOUND' } })

    render(<TicketDetail ticketId={42} requesterId={1} onBackToMyTickets={() => {}} />)

    expect(await screen.findByText('Ticket not found.')).toBeInTheDocument()
  })

  it('shows an access-denied state for a ticket owned by a different Requester (AC-03)', async () => {
    stubFetch({ ticketStatus: 403, ticketBody: { error: 'TICKET_FORBIDDEN' } })

    render(<TicketDetail ticketId={42} requesterId={1} onBackToMyTickets={() => {}} />)

    expect(await screen.findByText('You do not have access to this ticket.')).toBeInTheDocument()
  })
})
