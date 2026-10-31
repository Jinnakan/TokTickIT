import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App.js'
import { requesterDashboard, staffDashboard } from './dashboard-test-helpers.js'
import { getNavItemsForRole } from '../../src/nav/role-navigation-factory.js'
import { initialNavState, navReducer } from '../../src/nav/app-navigation.js'

describe('Navigation items per role (UI4-24, BR-L4-23)', () => {
  it('lists the right items with Dashboard first', () => {
    expect(getNavItemsForRole('REQUESTER').map((item) => item.label)).toEqual(['Dashboard', 'My Tickets', 'Create Ticket'])
    expect(getNavItemsForRole('IT_STAFF').map((item) => item.label)).toEqual(['Dashboard', 'Ticket Queue'])
    expect(getNavItemsForRole('ADMINISTRATOR').map((item) => item.label)).toEqual(['Dashboard', 'Ticket Queue', 'User Management'])
  })
})

describe('navReducer (UI4-24)', () => {
  it('lands every role on the Dashboard with no filters and no open Ticket', () => {
    for (const role of ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const) {
      const state = initialNavState(role)
      expect(state.place).toEqual({ key: 'dashboard', filters: {} })
      expect(state.openTicketId).toBeNull()
    }
  })

  it('goto sets the place and filters and gives the screen a new identity', () => {
    const start = initialNavState('IT_STAFF')
    const next = navReducer(start, { type: 'goto', key: 'ticket-queue', filters: { statusGroup: 'active', unassignedOnly: 'true' } })
    expect(next.place).toEqual({ key: 'ticket-queue', filters: { statusGroup: 'active', unassignedOnly: 'true' } })
    expect(next.placeSeq).toBe(start.placeSeq + 1)
    const same = navReducer(next, { type: 'goto', key: 'ticket-queue' })
    expect(same.place.filters).toEqual({})
    expect(same.placeSeq).toBe(next.placeSeq + 1)
  })

  it('opening a Ticket keeps the place, and closing returns to it with a refresh', () => {
    const queue = navReducer(initialNavState('IT_STAFF'), { type: 'goto', key: 'ticket-queue', filters: { statusGroup: 'active' } })
    const opened = navReducer(queue, { type: 'open', ticketId: 42 })
    expect(opened.openTicketId).toBe(42)
    expect(opened.place).toEqual(queue.place)
    expect(opened.placeSeq).toBe(queue.placeSeq)

    const closed = navReducer(opened, { type: 'close' })
    expect(closed.openTicketId).toBeNull()
    expect(closed.place).toEqual(queue.place)
    expect(closed.listRefresh).toBe(opened.listRefresh + 1)
  })

  it('navigating while a Ticket is open closes it', () => {
    const opened = navReducer(initialNavState('REQUESTER'), { type: 'open', ticketId: 7 })
    const moved = navReducer(opened, { type: 'goto', key: 'my-tickets' })
    expect(moved.openTicketId).toBeNull()
    expect(moved.place.key).toBe('my-tickets')
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

type Account = { id: number; name: string; role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR' }

function stubApp(user: Account) {
  const requests: string[] = []
  const queue = {
    data: [{
      id: 43, ticketNumber: 'TKT-2026-000043', summary: 'VPN keeps disconnecting', categoryId: 1, requestedPriority: 'HIGH', itPriority: 'HIGH',
      currentStatus: 'OPEN', ticketOwnerId: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      requester: { id: 2, name: 'Sarah Johnson' }, ticketOwner: null, requesterResolvedAt: null,
    }],
    meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    requests.push(url)
    const reply = (json: unknown) => ({ ok: true, status: 200, json: async () => json }) as Response
    if (url === '/api/auth/me') return reply({ ...user, email: 'x@toktickit.test', mustChangePassword: false })
    if (url === '/api/dashboard/requester') return reply(requesterDashboard)
    if (url === '/api/dashboard/staff') return reply(staffDashboard({ users: { active: 3, inactive: 1, byRole: { REQUESTER: 2, IT_STAFF: 1, ADMINISTRATOR: 1 } } }))
    if (url === '/api/categories' || url === '/api/related-systems') return reply([])
    if (url === '/api/tickets/42') return reply({ id: 42, ticketNumber: 'TKT-2026-000042', requesterId: 1, categoryId: 1, relatedSystemId: 1, requestedPriority: 'MEDIUM', currentStatus: 'OPEN', summary: 'Laptop battery drains quickly', description: 'Battery drains fast.', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', version: 1, requesterResolvedAt: null, actionsSummary: { total: 0, planned: 0, inProgress: 0, completed: 0, cancelled: 0, openFollowUps: 0 } })
    if (url === '/api/tickets/43') {
      return reply({
        ...queue.data[0], description: 'The VPN drops every few minutes.', relatedSystemId: 1, version: 1, requesterResolvedAt: null,
        allowedStatuses: ['IN_PROGRESS', 'CANCELLED'], actionsSummary: { total: 0, planned: 0, inProgress: 0, completed: 0, cancelled: 0, openFollowUps: 0 },
        resolution: { canResolve: false, blockers: [{ code: 'NO_COMPLETED_ACTION' }] },
      })
    }
    if (url.startsWith('/api/tickets?')) return reply(queue)
    if (url === '/api/users') return reply([])
    return reply([])
  }))
  return requests
}

describe('App landing and navigation (UI4-24, AC-L4-30)', () => {
  it('lands each role on its Dashboard with the right nav and marks the active item', async () => {
    stubApp({ id: 1, name: 'Jennifer Anderson', role: 'REQUESTER' })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Welcome, Jennifer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'My Tickets' })).not.toHaveAttribute('aria-current')
  })

  it('gives the Administrator the Ticket Queue and User Management beside the Dashboard', async () => {
    stubApp({ id: 20, name: 'Morgan Kim', role: 'ADMINISTRATOR' })
    render(<App />)
    await screen.findByRole('heading', { name: 'Welcome, Morgan' })
    for (const label of ['Dashboard', 'Ticket Queue', 'User Management']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('a staff card opens the queue with the filter applied and shown', async () => {
    const requests = stubApp({ id: 9, name: 'Alex Rivera', role: 'IT_STAFF' })
    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Unassigned, 7 tickets' }))

    expect(await screen.findByRole('heading', { name: 'Ticket Queue' })).toBeInTheDocument()
    expect(screen.getByText('Showing: Active tickets')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ticket Queue' })).toHaveAttribute('aria-current', 'page')
    await waitFor(() => {
      expect(requests.some((url) => url.startsWith('/api/tickets?') && url.includes('statusGroup=active') && url.includes('unassignedOnly=true'))).toBe(true)
    })
  })

  it('a dashboard row opens the Ticket and Back returns to the Dashboard', async () => {
    stubApp({ id: 1, name: 'Jennifer Anderson', role: 'REQUESTER' })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /TKT-2026-000042/ }))

    expect(await screen.findByRole('button', { name: '← Back to Dashboard' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Back to Dashboard' }))
    expect(await screen.findByRole('heading', { name: 'Welcome, Jennifer' })).toBeVisible()
  })

  it('Back from a Ticket restores the queue with the typed search and the drill-down filter', async () => {
    const requests = stubApp({ id: 9, name: 'Alex Rivera', role: 'IT_STAFF' })
    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Unassigned, 7 tickets' }))
    const search = await screen.findByLabelText('Search tickets')
    fireEvent.change(search, { target: { value: 'vpn' } })
    await waitFor(() => expect(requests.some((url) => url.includes('search=vpn'))).toBe(true))

    fireEvent.click((await screen.findAllByText('TKT-2026-000043'))[0])
    expect(await screen.findByRole('button', { name: '← Ticket Queue' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Search tickets')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '← Ticket Queue' }))
    expect(await screen.findByLabelText('Search tickets')).toHaveValue('vpn')
    expect(screen.getByText('Showing: Active tickets')).toBeInTheDocument()
  })
})
