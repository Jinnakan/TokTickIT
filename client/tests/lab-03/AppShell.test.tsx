import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App.js'
import { stubAppFetch } from '../lab-02/test-helpers.js'

const requesterUser = { id: 1, email: 'jennifer.anderson@toktickit.test', name: 'Jennifer Anderson', role: 'REQUESTER', mustChangePassword: false }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App auth gate and role-based shell (Issue 16)', () => {
  it('shows Login when there is no session', async () => {
    stubAppFetch({})

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'TokTickIT' })).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Email *')).toBeInTheDocument()
  })

  it('shows the role-appropriate nav and current user for a Requester session', async () => {
    stubAppFetch({ currentUser: requesterUser })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'My Tickets' })).toBeInTheDocument()
    })
    expect(screen.getAllByRole('button', { name: 'Create Ticket' }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Jennifer Anderson/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
  })

  it('shows ChangePassword instead of the shell when mustChangePassword is true', async () => {
    stubAppFetch({ currentUser: { ...requesterUser, mustChangePassword: true } })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'My Tickets' })).not.toBeInTheDocument()
  })

  it('Logout returns to the Login screen', async () => {
    stubAppFetch({ currentUser: requesterUser })
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/logout') {
        return { ok: true, status: 200, json: async () => ({ success: true }) } as Response
      }
      if (url === '/api/auth/me') {
        // First call (mount) returns the logged-in user; after logout, null.
        const alreadyLoggedOut = (globalThis as { __loggedOut?: boolean }).__loggedOut
        return {
          ok: !alreadyLoggedOut,
          status: alreadyLoggedOut ? 401 : 200,
          json: async () => (alreadyLoggedOut ? { error: 'UNAUTHENTICATED' } : requesterUser),
        } as Response
      }
      if (url.startsWith('/api/tickets')) {
        return { ok: true, json: async () => ({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } }) } as Response
      }
      return { ok: true, json: async () => [] } as Response
    }))

    render(<App />)

    const logoutButton = await screen.findByRole('button', { name: 'Logout' })
    ;(globalThis as { __loggedOut?: boolean }).__loggedOut = true
    fireEvent.click(logoutButton)

    await waitFor(() => {
      expect(screen.getByLabelText('Email *')).toBeInTheDocument()
    })

    delete (globalThis as { __loggedOut?: boolean }).__loggedOut
  })
})
