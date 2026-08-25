import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UI-02: loading state changes to category list', () => {
  it('shows a loading state and then the categories returned by the API', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', service: 'TokTickIT API' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, name: 'Account and Access' },
          { id: 2, name: 'Hardware' },
          { id: 3, name: 'Software' },
          { id: 4, name: 'Network' },
        ],
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Check System' }))

    expect(screen.getByRole('status')).toHaveTextContent('Loading system information')

    await waitFor(() => {
      expect(screen.getByText('Supported Request Categories')).toBeInTheDocument()
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Account and Access')).toBeInTheDocument()
    expect(screen.getByText('Hardware')).toBeInTheDocument()
    expect(screen.getByText('Software')).toBeInTheDocument()
    expect(screen.getByText('Network')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/health', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/categories', expect.any(Object))
  })
})
