import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StaffDashboard } from '../../src/components/dashboard/StaffDashboard.js'
import { emptyStaffDashboard, staffDashboard } from './dashboard-test-helpers.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mount(role: 'IT_STAFF' | 'ADMINISTRATOR', body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as Response))
  const onNavigate = vi.fn()
  const onOpenTicket = vi.fn()
  render(<StaffDashboard role={role} firstName="Alex" onNavigate={onNavigate} onOpenTicket={onOpenTicket} refreshKey={0} />)
  return { onNavigate, onOpenTicket }
}

describe('Staff dashboard (UI4-05 to UI4-07)', () => {
  it('UI4-05 renders cards, breakdowns and lists, and each link opens the right drill-down', async () => {
    const { onNavigate, onOpenTicket } = mount('IT_STAFF', staffDashboard())

    fireEvent.click(await screen.findByRole('link', { name: 'Unassigned, 7 tickets' }))
    expect(onNavigate).toHaveBeenLastCalledWith('ticket-queue', { unassignedOnly: 'true', statusGroup: 'active' })
    fireEvent.click(screen.getByRole('link', { name: 'Owned by me, 4 tickets' }))
    expect(onNavigate).toHaveBeenLastCalledWith('ticket-queue', { ticketOwnerId: '9', statusGroup: 'active' })
    fireEvent.click(screen.getByRole('link', { name: 'Reported resolved by Requester, 2 tickets' }))
    expect(onNavigate).toHaveBeenLastCalledWith('ticket-queue', { requesterReportedResolved: 'true', statusGroup: 'active' })

    const byStatus = screen.getByRole('region', { name: 'By status' })
    expect(within(byStatus).getAllByRole('link')).toHaveLength(8)
    fireEvent.click(within(byStatus).getByRole('link', { name: 'Open, 1 ticket' }))
    expect(onNavigate).toHaveBeenLastCalledWith('ticket-queue', { currentStatus: 'OPEN' })

    const byPriority = screen.getByRole('region', { name: 'By IT Priority' })
    expect(within(byPriority).getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual([
      'High priority, 3 tickets',
      'Medium priority, 2 tickets',
      'Low priority, 1 ticket',
    ])
    fireEvent.click(within(byPriority).getByRole('link', { name: 'High priority, 3 tickets' }))
    expect(onNavigate).toHaveBeenLastCalledWith('ticket-queue', { itPriority: 'HIGH', statusGroup: 'active' })

    fireEvent.click(screen.getByRole('button', { name: /TKT-2026-000042: Replace the docking station firmware\./ }))
    expect(onOpenTicket).toHaveBeenCalledWith(42)
    fireEvent.click(screen.getByRole('button', { name: /TKT-2026-000043: VPN keeps disconnecting/ }))
    expect(onOpenTicket).toHaveBeenLastCalledWith(43)
  })

  it('shows My open actions as a card that is not a link', async () => {
    mount('IT_STAFF', staffDashboard())
    await screen.findByRole('link', { name: 'Unassigned, 7 tickets' })
    expect(screen.queryByRole('link', { name: /My open actions/ })).not.toBeInTheDocument()
    expect(screen.getByText('See the list below')).toBeInTheDocument()
  })

  it('UI4-06 shows the users strip only to an Administrator', async () => {
    const users = { active: 9, inactive: 2, byRole: { REQUESTER: 5, IT_STAFF: 4, ADMINISTRATOR: 2 } }
    const { onNavigate } = mount('ADMINISTRATOR', staffDashboard({ users }))
    const strip = await screen.findByRole('button', { name: /9 active · 2 inactive/ })
    expect(strip).toHaveTextContent('5 Requester · 4 IT Staff · 2 Administrator')
    fireEvent.click(strip)
    expect(onNavigate).toHaveBeenCalledWith('user-management')
  })

  it('UI4-06 omits the users strip for IT Staff', async () => {
    mount('IT_STAFF', staffDashboard())
    await screen.findByRole('link', { name: 'Unassigned, 7 tickets' })
    expect(screen.queryByText(/inactive/)).not.toBeInTheDocument()
  })

  it('UI4-07 shows zeros and the empty messages', async () => {
    mount('IT_STAFF', emptyStaffDashboard)
    expect(await screen.findByRole('link', { name: 'Unassigned, 0 tickets' })).toBeInTheDocument()
    expect(screen.getByText('Nothing planned for you.')).toBeInTheDocument()
    expect(screen.getByText('No recent tickets yet.')).toBeInTheDocument()
    const byStatus = screen.getByRole('region', { name: 'By status' })
    expect(within(byStatus).getAllByRole('link')).toHaveLength(8)
  })
})

describe('Accessible names and non-color state (A11Y4-02, ST4-01, AC-L4-29)', () => {
  it('every card and breakdown link names its label and its count', async () => {
    mount('IT_STAFF', staffDashboard())
    await screen.findByRole('link', { name: 'Unassigned, 7 tickets' })
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThanOrEqual(14)
    for (const link of links) {
      expect(link.getAttribute('aria-label')).toMatch(/.+, \d+ tickets?$/)
    }
  })

  it('shows each status as words, not only as a color', async () => {
    mount('IT_STAFF', staffDashboard())
    const byStatus = await screen.findByRole('region', { name: 'By status' })
    for (const label of ['New', 'Open', 'In Progress', 'Waiting for Requester', 'Resolved', 'Closed', 'Reopened', 'Cancelled']) {
      expect(within(byStatus).getByText(label)).toBeInTheDocument()
    }
  })
})
