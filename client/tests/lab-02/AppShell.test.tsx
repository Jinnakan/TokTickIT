import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App.js'

const seededRequesters = [
  { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@toktickit.test' },
]

beforeEach(() => {
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App shell requester context', () => {
  it('restores the selected Requester from sessionStorage on load', async () => {
    window.sessionStorage.setItem('toktickit.devRequesterId', '1')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => seededRequesters }))

    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('Jennifer Anderson').length).toBeGreaterThan(0)
    })
    expect(screen.getByRole('button', { name: 'Change Requester' })).toBeInTheDocument()
  })

  it('treats a stored id for a no-longer-active Requester as no selection', async () => {
    window.sessionStorage.setItem('toktickit.devRequesterId', '999')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => seededRequesters }))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'TokTickIT' })).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Development Requester *')).toBeInTheDocument()
  })

  it('Change Requester clears the selection and returns to the Selection screen', async () => {
    window.sessionStorage.setItem('toktickit.devRequesterId', '1')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => seededRequesters }))

    render(<App />)

    const changeButton = await screen.findByRole('button', { name: 'Change Requester' })
    fireEvent.click(changeButton)

    expect(await screen.findByLabelText('Development Requester *')).toBeInTheDocument()
    expect(window.sessionStorage.getItem('toktickit.devRequesterId')).toBeNull()
  })
})
