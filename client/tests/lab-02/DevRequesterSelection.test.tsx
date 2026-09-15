import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App.js'
import { stubAppFetch } from './test-helpers.js'

const seededRequesters = [
  { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@toktickit.test' },
  { id: 2, name: 'Sarah Johnson', email: 'sarah.johnson@toktickit.test' },
]

beforeEach(() => {
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Development Requester Selection', () => {
  it('shows a loading state while requesters are being fetched', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading development requesters')
  })

  it('shows an empty state when no active requesters are returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/No active development requesters are available/)).toBeInTheDocument()
    })
  })

  it('shows a safe failure state with retry when the API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to load development requesters')
    })
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('lets a Requester select an identity and reach the app shell', async () => {
    stubAppFetch({ devRequesters: seededRequesters })

    render(<App />)

    const select = await screen.findByLabelText('Development Requester *')
    fireEvent.change(select, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Johnson').length).toBeGreaterThan(0)
    })
    expect(screen.getByRole('button', { name: 'Change Requester' })).toBeInTheDocument()
    expect(window.sessionStorage.getItem('toktickit.devRequesterId')).toBe('2')
  })
})
