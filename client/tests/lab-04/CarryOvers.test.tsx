import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StaffTicketDetail } from '../../src/components/StaffTicketDetail.js'
import { TicketDetail } from '../../src/components/TicketDetail.js'
import { UserManagement } from '../../src/components/UserManagement.js'

const categories = [{ id: 1, name: 'Hardware' }]
const relatedSystems = [{ id: 7, name: 'Corporate Laptop' }]

const staffTicket = {
  id: 42,
  ticketNumber: 'TKT-2026-000042',
  requesterId: 1,
  categoryId: 1,
  relatedSystemId: 7,
  requestedPriority: 'MEDIUM',
  itPriority: 'MEDIUM',
  currentStatus: 'OPEN',
  ticketOwnerId: 9,
  summary: 'Laptop battery drains quickly',
  description: 'The battery drains much faster than it used to.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  requester: { id: 1, name: 'Jennifer Anderson' },
  ticketOwner: { id: 9, name: 'Alex Rivera' },
  allowedStatuses: ['IN_PROGRESS', 'CANCELLED'],
}

const assignable = [
  { id: 9, name: 'Alex Rivera', role: 'IT_STAFF' },
  { id: 10, name: 'Priya Nair', role: 'IT_STAFF' },
  { id: 20, name: 'Morgan Kim', role: 'ADMINISTRATOR' },
]

const activeAttachment = {
  id: 1, originalFilename: 'photo.jpg', mimeType: 'image/jpeg', sizeBytes: 2048,
  uploadedAt: '2026-01-01T00:00:00.000Z', isRemoved: false, removedAt: null, removedReason: null,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubTicketFetch(options: { onReassign?: (body: unknown) => void; assignableOk?: boolean } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/tickets/42/reassign' && init?.method === 'POST') {
      options.onReassign?.(JSON.parse(String(init.body)))
      return { ok: true, status: 200, json: async () => ({ ...staffTicket, ticketOwnerId: 10 }) } as Response
    }
    if (url === '/api/tickets/42') return { ok: true, status: 200, json: async () => staffTicket } as Response
    if (url === '/api/users/assignable') {
      return options.assignableOk === false
        ? ({ ok: false, status: 500, json: async () => ({ error: 'INTERNAL_ERROR' }) } as Response)
        : ({ ok: true, json: async () => assignable } as Response)
    }
    if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
    if (url === '/api/related-systems') return { ok: true, json: async () => relatedSystems } as Response
    if (url === '/api/tickets/42/attachments') return { ok: true, json: async () => [activeAttachment] } as Response
    if (url === '/api/tickets/42/actions') return { ok: true, json: async () => [] } as Response
    if (url === '/api/tickets/42/comments') return { ok: true, json: async () => [] } as Response
    if (url === '/api/tickets/42/notes') return { ok: true, json: async () => [] } as Response
    throw new Error(`Unexpected fetch: ${url}`)
  }))
}

describe('Reassign control (UI4-23, FR-L4-15)', () => {
  it('lists assignable users except the current owner and reassigns on click', async () => {
    let posted: unknown = null
    stubTicketFetch({ onReassign: (body) => { posted = body } })

    render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)

    const select = await screen.findByLabelText('Reassign to')
    await waitFor(() => {
      expect(within(select).getByRole('option', { name: /Priya Nair/ })).toBeInTheDocument()
    })
    expect(within(select).getByRole('option', { name: /Morgan Kim/ })).toBeInTheDocument()
    expect(within(select).queryByRole('option', { name: /Alex Rivera/ })).not.toBeInTheDocument()

    const button = screen.getByRole('button', { name: 'Reassign' })
    expect(button).toBeDisabled()
    fireEvent.change(select, { target: { value: '10' } })
    expect(button).toBeEnabled()
    fireEvent.click(button)

    await waitFor(() => {
      expect(posted).toEqual({ ticketOwnerId: 10 })
    })
  })

  it('shows a safe message when the staff list cannot load and keeps the rest of the screen', async () => {
    stubTicketFetch({ assignableOk: false })

    render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)

    expect(await screen.findByText(/Unable to load the staff list/)).toBeInTheDocument()
    expect(screen.getByText('Laptop battery drains quickly')).toBeInTheDocument()
  })
})

describe('Attachment controls by role (UI4-23, AC-L4-27)', () => {
  it('shows Download but no Add or Remove to IT Staff', async () => {
    stubTicketFetch()

    render(<StaffTicketDetail ticketId={42} currentUserId={9} onBackToQueue={() => {}} />)

    expect(await screen.findByText('photo.jpg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.queryByText('Add attachment')).not.toBeInTheDocument()
  })

  it('keeps Add and Remove for the Requester who owns the ticket', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/tickets/42') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 42, ticketNumber: 'TKT-2026-000042', requesterId: 1, categoryId: 1, relatedSystemId: 7,
            requestedPriority: 'MEDIUM', currentStatus: 'OPEN', summary: 'Laptop battery drains quickly',
            description: 'The battery drains much faster than it used to.',
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        } as Response
      }
      if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
      if (url === '/api/related-systems') return { ok: true, json: async () => relatedSystems } as Response
      if (url === '/api/tickets/42/attachments') return { ok: true, json: async () => [activeAttachment] } as Response
      return { ok: true, json: async () => [] } as Response
    }))

    render(<TicketDetail ticketId={42} onBackToMyTickets={() => {}} />)

    expect(await screen.findByText('photo.jpg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(screen.getByText('Add attachment')).toBeInTheDocument()
  })
})

const alex = {
  id: 1, email: 'alex.rivera@toktickit.test', name: 'Alex Rivera', role: 'IT_STAFF', isActive: true,
  mustChangePassword: false, createdAt: '2026-01-01T00:00:00.000Z',
}

function failure(status: number, body: Record<string, unknown>): Response {
  return { ok: false, status, json: async () => body } as Response
}

function stubUsers(handlers: { patch?: () => Response; deactivate?: () => Response }) {
  const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined
    calls.push({ url, method, body })
    if (method === 'GET') {
      return { ok: true, json: async () => ({ data: [alex], meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } }) } as Response
    }
    if (method === 'PATCH') return handlers.patch?.() ?? ({ ok: true, json: async () => alex } as Response)
    if (url.endsWith('/deactivate')) return handlers.deactivate?.() ?? ({ ok: true, json: async () => ({ id: 1, isActive: false }) } as Response)
    return { ok: true, json: async () => ({}) } as Response
  }))
  return calls
}

describe('User management carry-overs (UI4-23, FR-L4-16, FR-L4-17)', () => {
  it('makes Email editable and sends the changed email in the update', async () => {
    const calls = stubUsers({})

    render(<UserManagement />)
    await screen.findByText('Alex Rivera')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])

    const emailInput = screen.getByLabelText('Email')
    expect(emailInput).toBeEnabled()
    fireEvent.change(emailInput, { target: { value: 'alex.new@toktickit.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }))

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'PATCH' && call.body?.email === 'alex.new@toktickit.test')).toBe(true)
    })
  })

  it('does not send the email when it was not changed', async () => {
    const calls = stubUsers({})

    render(<UserManagement />)
    await screen.findByText('Alex Rivera')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex R.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }))

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'PATCH')).toBe(true)
    })
    expect(calls.find((call) => call.method === 'PATCH')?.body).not.toHaveProperty('email')
  })

  it('names the problem when the email is already in use', async () => {
    stubUsers({ patch: () => failure(400, { error: 'EMAIL_TAKEN' }) })

    render(<UserManagement />)
    await screen.findByText('Alex Rivera')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'taken@toktickit.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }))

    expect(await screen.findByText('That email address is already in use.')).toBeInTheDocument()
    expect(screen.queryByText('Request failed.')).not.toBeInTheDocument()
  })

  it('names the problem when an Administrator deactivates their own account', async () => {
    stubUsers({ deactivate: () => failure(409, { error: 'SELF_DEACTIVATION', message: 'You cannot deactivate your own account.' }) })

    render(<UserManagement />)
    await screen.findByText('Alex Rivera')
    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[0])
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Deactivate' }))

    expect(await screen.findByText('You cannot deactivate your own account.')).toBeInTheDocument()
    expect(screen.queryByText('Unable to deactivate this user.')).not.toBeInTheDocument()
  })

  it('names the problem when the last active Administrator would be removed', async () => {
    stubUsers({ deactivate: () => failure(409, { error: 'LAST_ADMINISTRATOR' }) })

    render(<UserManagement />)
    await screen.findByText('Alex Rivera')
    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[0])
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Deactivate' }))

    expect(await screen.findByText('At least one active Administrator must remain.')).toBeInTheDocument()
  })
})
