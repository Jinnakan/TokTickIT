import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RequesterDashboard } from '../../src/components/RequesterDashboard.js'
import { emptyRequesterDashboard, requesterDashboard } from './dashboard-test-helpers.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubDashboard(answers: Array<{ ok: boolean; body: unknown }>) {
  let call = 0
  const fetchStub = vi.fn(async () => {
    const answer = answers[Math.min(call, answers.length - 1)]
    call += 1
    return { ok: answer.ok, status: answer.ok ? 200 : 500, json: async () => answer.body } as Response
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

function mount() {
  const onNavigate = vi.fn()
  const onOpenTicket = vi.fn()
  render(<RequesterDashboard firstName="Jennifer" onNavigate={onNavigate} onOpenTicket={onOpenTicket} refreshKey={0} />)
  return { onNavigate, onOpenTicket }
}

describe('Requester dashboard (UI4-01 to UI4-04)', () => {
  it('UI4-01 shows the welcome line, four cards with counts, and both lists', async () => {
    stubDashboard([{ ok: true, body: requesterDashboard }])
    mount()

    expect(await screen.findByRole('heading', { name: 'Welcome, Jennifer' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open tickets, 3 tickets' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'In progress, 1 ticket' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Waiting for you, 1 ticket' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resolved, 2 tickets' })).toBeInTheDocument()
    expect(screen.getByText(/TKT-2026-000042: Laptop battery drains quickly/)).toBeInTheDocument()
    expect(screen.getByText(/TKT-2026-000040: Docking station fixed/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Ticket' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View My Tickets' })).toBeInTheDocument()
  })

  it('UI4-02 shows 0 on the cards and the empty messages, with the cards still links', async () => {
    stubDashboard([{ ok: true, body: emptyRequesterDashboard }])
    mount()

    expect(await screen.findByRole('link', { name: 'Open tickets, 0 tickets' })).toBeInTheDocument()
    expect(screen.getAllByText('No recent tickets yet.')).toHaveLength(2)
  })

  it('UI4-03 a card opens the filtered list and a row opens the Ticket', async () => {
    stubDashboard([{ ok: true, body: requesterDashboard }])
    const { onNavigate, onOpenTicket } = mount()

    fireEvent.click(await screen.findByRole('link', { name: 'Waiting for you, 1 ticket' }))
    expect(onNavigate).toHaveBeenCalledWith('my-tickets', { statusGroup: 'waiting' })

    fireEvent.click(screen.getByRole('button', { name: /TKT-2026-000042/ }))
    expect(onOpenTicket).toHaveBeenCalledWith(42)
  })

  it('UI4-04 shows Loading, then a safe failure whose Retry loads the data', async () => {
    const fetchStub = stubDashboard([{ ok: false, body: { error: 'INTERNAL_ERROR' } }, { ok: true, body: requesterDashboard }])
    mount()

    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Unable to load the dashboard.')
    expect(alert).not.toHaveTextContent(/500|INTERNAL/)

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('link', { name: 'Open tickets, 3 tickets' })).toBeInTheDocument()
    expect(fetchStub).toHaveBeenCalledTimes(2)
  })

  it('Refresh refetches, announces the update politely, and is disabled while loading', async () => {
    const fetchStub = stubDashboard([{ ok: true, body: requesterDashboard }])
    mount()
    await screen.findByRole('link', { name: 'Open tickets, 3 tickets' })

    const refresh = screen.getByRole('button', { name: 'Refresh' })
    fireEvent.click(refresh)
    expect(refresh).toBeDisabled()
    // The data stays on screen while it refreshes, so the layout does not jump.
    expect(screen.getByRole('link', { name: 'Open tickets, 3 tickets' })).toBeInTheDocument()
    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Dashboard updated')).toBeInTheDocument()
  })
})
