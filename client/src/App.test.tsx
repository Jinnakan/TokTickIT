import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TokTickIT category list', () => {
  it('shows categories returned by the API after checking the system', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', service: 'TokTickIT API' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 12, name: 'Account and Access' },
          { id: 24, name: 'Hardware' },
        ],
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Check System' }))

    expect(screen.getByRole('status')).toHaveTextContent('Loading system information')

    await waitFor(() => {
      expect(screen.getByText('Supported Request Categories')).toBeInTheDocument()
    })

    expect(screen.getByText('Account and Access')).toBeInTheDocument()
    expect(screen.getByText('Hardware')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/health', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/categories', expect.any(Object))
  })

  it('shows a useful error when the API request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Check System' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to connect to TokTickIT API',
    )
  })
})
