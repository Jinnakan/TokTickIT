import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MyTicketsList } from '../../src/components/MyTicketsList.js'
import { stubAppFetch } from './test-helpers.js'

const categories = [{ id: 1, name: 'Hardware' }]

function ticketRow(overrides: Partial<{
  id: number
  ticketNumber: string
  summary: string
}> = {}) {
  return {
    id: overrides.id ?? 1,
    ticketNumber: overrides.ticketNumber ?? 'TKT-2026-000001',
    summary: overrides.summary ?? 'Laptop battery drains quickly',
    categoryId: 1,
    requestedPriority: 'MEDIUM',
    currentStatus: 'NEW',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function stubFetch(listResponse: { data: unknown[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }) {
  stubAppFetch({ categories, ticketsList: listResponse })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MyTicketsList', () => {
  it('shows the true-empty state when the Requester has zero tickets total (AC-10)', async () => {
    stubFetch({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } })

    render(<MyTicketsList requesterId={1} onCreateTicket={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent("You haven't created any tickets yet.")
    })
  })

  it('shows a distinct no-results state when a search matches nothing (AC-10)', async () => {
    stubFetch({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } })

    render(<MyTicketsList requesterId={1} onCreateTicket={() => {}} />)
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent("You haven't created any tickets yet.")
    })

    fireEvent.change(screen.getByLabelText('Search tickets'), { target: { value: 'nothing matches this' } })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('No tickets match your filters.')
    })
  })

  it('renders returned tickets with badges in the desktop table', async () => {
    stubFetch({ data: [ticketRow()], meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } })

    render(<MyTicketsList requesterId={1} onCreateTicket={() => {}} />)

    const table = await screen.findByRole('table')
    const withinTable = within(table)
    expect(withinTable.getByText('TKT-2026-000001')).toBeInTheDocument()
    expect(withinTable.getByText('Medium')).toBeInTheDocument()
    expect(withinTable.getByText('New')).toBeInTheDocument()
  })

  it('shows a failure state with no stale data on API failure (AC-18)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
      if (url.startsWith('/api/tickets')) return { ok: false, status: 500, json: async () => ({}) } as Response
      throw new Error(`Unexpected fetch: ${url}`)
    }))

    render(<MyTicketsList requesterId={1} onCreateTicket={() => {}} />)

    expect(await screen.findByText('Unable to load tickets.')).toBeInTheDocument()
  })

  it('paginates using Previous/Next based on meta (AC-11)', async () => {
    stubFetch({
      data: [ticketRow()],
      meta: { page: 1, pageSize: 1, totalItems: 2, totalPages: 2 },
    })

    render(<MyTicketsList requesterId={1} onCreateTicket={() => {}} />)
    const table = await screen.findByRole('table')
    within(table).getByText('TKT-2026-000001')

    const nextButton = screen.getByRole('button', { name: 'Next' })
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(nextButton).not.toBeDisabled()

    stubFetch({
      data: [ticketRow({ id: 2, ticketNumber: 'TKT-2026-000002', summary: 'Second page ticket' })],
      meta: { page: 2, pageSize: 1, totalItems: 2, totalPages: 2 },
    })
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(within(screen.getByRole('table')).getByText('TKT-2026-000002')).toBeInTheDocument()
    })
  })
})
