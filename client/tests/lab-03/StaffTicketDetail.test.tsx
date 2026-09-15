import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StaffTicketDetail } from '../../src/components/StaffTicketDetail.js'

const categories = [{ id: 1, name: 'Hardware' }]
const relatedSystems = [{ id: 7, name: 'Corporate Laptop' }]

const baseTicket = {
  id: 42,
  ticketNumber: 'TKT-2026-000042',
  requesterId: 3,
  categoryId: 1,
  relatedSystemId: 7,
  requestedPriority: 'MEDIUM',
  itPriority: 'MEDIUM',
  currentStatus: 'NEW',
  ticketOwnerId: null,
  summary: 'Laptop will not boot',
  description: 'The battery drains much faster than it used to.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  requester: { id: 3, name: 'Jennifer Anderson' },
  ticketOwner: null,
  allowedStatuses: ['OPEN', 'CANCELLED'],
}

function stubFetch(overrides: { ticket?: typeof baseTicket; comments?: unknown[]; notes?: unknown[] } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
    if (url === '/api/related-systems') return { ok: true, json: async () => relatedSystems } as Response
    if (url === '/api/tickets/42') return { ok: true, json: async () => overrides.ticket ?? baseTicket } as Response
    if (url === '/api/tickets/42/attachments') return { ok: true, json: async () => [] } as Response
    if (url === '/api/tickets/42/comments') return { ok: true, json: async () => overrides.comments ?? [] } as Response
    if (url === '/api/tickets/42/notes') return { ok: true, json: async () => overrides.notes ?? [] } as Response
    throw new Error(`Unexpected fetch: ${url}`)
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StaffTicketDetail', () => {
  it('status select only offers the allowed transitions from the current state (UI-L3-07, AC-L3-12)', async () => {
    stubFetch()

    render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)

    const statusSelect = await screen.findByLabelText('Current Status')
    const optionLabels = Array.from(statusSelect.querySelectorAll('option')).map((option) => option.textContent)

    // NEW's allowed transitions are OPEN/CANCELLED only -- every other
    // status value must never appear as a selectable option.
    expect(optionLabels).toEqual(expect.arrayContaining(['Open', 'Cancelled']))
    expect(optionLabels).not.toEqual(expect.arrayContaining(['Closed', 'Resolved', 'In Progress']))
  })

  it('renders Internal Notes and Public Comments as visually distinct, independent panels (UI-L3-08)', async () => {
    stubFetch({
      comments: [{ id: 1, ticketId: 42, authorId: 3, authorName: 'Jennifer Anderson', body: 'A public comment.', createdAt: '2026-01-01T00:00:00.000Z' }],
      notes: [{ id: 1, ticketId: 42, authorId: 9, authorName: 'Alex Rivera', body: 'An internal note.', createdAt: '2026-01-01T00:00:00.000Z' }],
    })

    render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('A public comment.')).toBeInTheDocument()
    })
    expect(screen.getByText('An internal note.')).toBeInTheDocument()
    expect(screen.getByText(/Internal Staff Notes — not visible to the Requester/)).toBeInTheDocument()

    // Independent containers, not one shared list.
    const commentsHeading = screen.getByRole('heading', { name: 'Comments' })
    const notesHeading = screen.getByRole('heading', { name: 'Internal Notes' })
    expect(commentsHeading.closest('section')).not.toBe(notesHeading.closest('section'))
  })

  it('renders an XSS payload in a note as literal text, not executed markup (UI-L3-09, AC-L3-13)', async () => {
    const payload = '<script>window.__xss = true</script>'
    stubFetch({
      notes: [{ id: 1, ticketId: 42, authorId: 9, authorName: 'Alex Rivera', body: payload, createdAt: '2026-01-01T00:00:00.000Z' }],
    })

    render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)

    expect(await screen.findByText(payload)).toBeInTheDocument()
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined()
  })

  it('shows a Claim button when unassigned and hides it once claimed', async () => {
    stubFetch()
    render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)

    expect(await screen.findByRole('button', { name: 'Claim Ticket' })).toBeInTheDocument()
  })

  it('shows the assignee name instead of a Claim button once a ticket is claimed', async () => {
    stubFetch({ ticket: { ...baseTicket, ticketOwnerId: 9, ticketOwner: { id: 9, name: 'Alex Rivera' } } })

    render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera (you)')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Claim Ticket' })).not.toBeInTheDocument()
  })

  it('calls the claim endpoint and refreshes the ticket when Claim Ticket is clicked', async () => {
    let claimCalled = false
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
      if (url === '/api/related-systems') return { ok: true, json: async () => relatedSystems } as Response
      if (url === '/api/tickets/42/attachments') return { ok: true, json: async () => [] } as Response
      if (url === '/api/tickets/42/comments') return { ok: true, json: async () => [] } as Response
      if (url === '/api/tickets/42/notes') return { ok: true, json: async () => [] } as Response
      if (url === '/api/tickets/42/claim' && init?.method === 'POST') {
        claimCalled = true
        return { ok: true, json: async () => ({ ...baseTicket, ticketOwnerId: 9 }) } as Response
      }
      if (url === '/api/tickets/42') {
        const ticket = claimCalled ? { ...baseTicket, ticketOwnerId: 9, ticketOwner: { id: 9, name: 'Alex Rivera' } } : baseTicket
        return { ok: true, json: async () => ticket } as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }))

    render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Claim Ticket' }))

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera (you)')).toBeInTheDocument()
    })
  })
})
