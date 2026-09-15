import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserManagement } from '../../src/components/UserManagement.js'

const oneUser = {
  data: [
    { id: 1, email: 'jennifer.anderson@toktickit.test', name: 'Jennifer Anderson', role: 'REQUESTER', isActive: true, mustChangePassword: false, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
}

function stubFetch(overrides: { onUsersRequest?: (url: string) => void; createResponse?: unknown } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/users') && (!init || init.method === undefined)) {
      overrides.onUsersRequest?.(url)
      return { ok: true, json: async () => oneUser } as Response
    }
    if (url === '/api/users' && init?.method === 'POST') {
      return {
        ok: true,
        json: async () => overrides.createResponse ?? {
          id: 2, email: 'new@toktickit.test', name: 'New User', role: 'REQUESTER', isActive: true, mustChangePassword: true,
          createdAt: '2026-01-01T00:00:00.000Z', initialPassword: 'Xk9#mQ2pLrAb',
        },
      } as Response
    }
    throw new Error(`Unexpected fetch: ${url} ${init?.method ?? 'GET'}`)
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UserManagement', () => {
  it('shows the generated initial password once after creating a user (UI-L3-10, AC-L3-14)', async () => {
    stubFetch()

    render(<UserManagement />)
    await screen.findByText('Jennifer Anderson')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New User' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@toktickit.test' } })
    const submitButton = screen.getAllByRole('button', { name: 'Create User' }).find((button) => button.getAttribute('type') === 'submit')!
    fireEvent.click(submitButton)

    expect(await screen.findByText('Xk9#mQ2pLrAb')).toBeInTheDocument()
    expect(screen.getByText(/will not be shown again/)).toBeInTheDocument()
  })

  it('requires confirmation before deactivating, and the confirmation mentions ending sessions (UI-L3-11)', async () => {
    stubFetch()

    render(<UserManagement />)
    await screen.findByText('Jennifer Anderson')

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(/end all of their active sessions/)
    // The destructive action itself is a separate confirm button, not fired yet.
    expect(screen.getAllByRole('button', { name: 'Deactivate' })).toHaveLength(2)
  })

  it('re-requests with the correct query params when a filter changes (UI-L3-12)', async () => {
    let lastUrl = ''
    stubFetch({ onUsersRequest: (url) => { lastUrl = url } })

    render(<UserManagement />)
    await screen.findByText('Jennifer Anderson')

    fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: 'IT_STAFF' } })

    await waitFor(() => {
      expect(lastUrl).toContain('role=IT_STAFF')
    })
  })

  it('shows the empty state when no users match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } }),
    }) as Response))

    render(<UserManagement />)

    await waitFor(() => {
      expect(screen.getByText('No users match your filters.')).toBeInTheDocument()
    })
  })
})
