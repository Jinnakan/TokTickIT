import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Login } from '../../src/components/Login.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Login', () => {
  it('shows the generic invalid-credentials message and clears the password (AC-L3-02)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }),
      }),
    )

    const onLoggedIn = vi.fn()
    render(<Login onLoggedIn={onLoggedIn} />)

    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'jane@toktickit.test' } })
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.')
    })
    expect(screen.getByLabelText('Password *')).toHaveValue('')
    expect(onLoggedIn).not.toHaveBeenCalled()
  })

  it('calls onLoggedIn with the returned user on success', async () => {
    const user = { id: 1, email: 'jane@toktickit.test', name: 'Jane', role: 'REQUESTER', mustChangePassword: false }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => user }))

    const onLoggedIn = vi.fn()
    render(<Login onLoggedIn={onLoggedIn} />)

    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'jane@toktickit.test' } })
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'DevPass123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(onLoggedIn).toHaveBeenCalledWith(user)
    })
  })

  it('shows the busy state and disables the form while submitting', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    render(<Login onLoggedIn={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'jane@toktickit.test' } })
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'DevPass123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    })
    expect(screen.getByLabelText('Email *')).toBeDisabled()
  })

  it('shows a lockout message distinct from invalid credentials (AC-L3-06)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'TOO_MANY_ATTEMPTS', message: 'Too many failed attempts. Try again later.' }),
      }),
    )

    render(<Login onLoggedIn={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'jane@toktickit.test' } })
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'DevPass123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Too many failed attempts')
    })
  })

  it('toggles password visibility', () => {
    render(<Login onLoggedIn={vi.fn()} />)

    const passwordInput = screen.getByLabelText('Password *')
    expect(passwordInput).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(passwordInput).toHaveAttribute('type', 'text')
  })
})
