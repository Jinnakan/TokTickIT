import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UI-03: API failure error message', () => {
  it('displays a useful error message when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Check System' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to connect to TokTickIT API',
    )
    expect(screen.getByText('System Status: Offline')).toBeInTheDocument()
  })
})
