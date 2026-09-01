import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateTicketForm } from '../../src/components/CreateTicketForm.js'

const categories = [{ id: 1, name: 'Hardware' }]
const relatedSystems = [{ id: 6, name: 'Corporate Laptop' }]

function stubReferenceDataFetch(extra?: (url: string, init?: RequestInit) => Response | null) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (extra) {
      const custom = extra(url, init)
      if (custom) return custom
    }
    if (url === '/api/categories') {
      return { ok: true, json: async () => categories } as Response
    }
    if (url === '/api/related-systems') {
      return { ok: true, json: async () => relatedSystems } as Response
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

async function renderReadyForm() {
  stubReferenceDataFetch()
  render(<CreateTicketForm requesterId={1} />)
  await screen.findByRole('heading', { name: 'Create Ticket' })
}

describe('CreateTicketForm', () => {
  it('shows a field-level message and does not call the API when Summary is blank (AC-04)', async () => {
    let ticketPostCalled = false
    stubReferenceDataFetch((url) => {
      if (url === '/api/tickets') {
        ticketPostCalled = true
      }
      return null
    })
    render(<CreateTicketForm requesterId={1} />)
    await screen.findByRole('heading', { name: 'Create Ticket' })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Summary must be 5-150 characters.')).toBeInTheDocument()
    expect(ticketPostCalled).toBe(false)
  })

  it('shows the busy state while the request is in flight', async () => {
    let resolvePost: (() => void) | undefined
    stubReferenceDataFetch((url) => {
      if (url === '/api/tickets') {
        return null
      }
      return null
    })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
      if (url === '/api/related-systems') return { ok: true, json: async () => relatedSystems } as Response
      if (url === '/api/tickets') {
        return new Promise<Response>((resolve) => {
          resolvePost = () => resolve({
            ok: true,
            status: 201,
            json: async () => ({ id: 1, ticketNumber: 'TKT-2026-000001' }),
          } as Response)
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }))

    render(<CreateTicketForm requesterId={1} />)
    await screen.findByRole('heading', { name: 'Create Ticket' })

    fireEvent.change(screen.getByLabelText('Category *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Related System *'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Requested Priority *'), { target: { value: 'MEDIUM' } })
    fireEvent.change(screen.getByLabelText('Ticket Summary *'), { target: { value: 'Laptop battery drains quickly' } })
    fireEvent.change(screen.getByLabelText('Description *'), {
      target: { value: 'The battery drains much faster than it used to.' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByRole('button', { name: 'Submitting…' })).toBeDisabled()
    resolvePost?.()

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
    })
  })

  it('shows the success state with the returned Ticket Number (AC-01)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
      if (url === '/api/related-systems') return { ok: true, json: async () => relatedSystems } as Response
      if (url === '/api/tickets') {
        return { ok: true, status: 201, json: async () => ({ id: 1, ticketNumber: 'TKT-2026-000042' }) } as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }))

    render(<CreateTicketForm requesterId={1} />)
    await screen.findByRole('heading', { name: 'Create Ticket' })

    fireEvent.change(screen.getByLabelText('Category *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Related System *'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Requested Priority *'), { target: { value: 'MEDIUM' } })
    fireEvent.change(screen.getByLabelText('Ticket Summary *'), { target: { value: 'Laptop battery drains quickly' } })
    fireEvent.change(screen.getByLabelText('Description *'), {
      target: { value: 'The battery drains much faster than it used to.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('TKT-2026-000042')).toBeInTheDocument()
  })

  it('surfaces server-side field errors returned after submission (AC-06)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/categories') return { ok: true, json: async () => categories } as Response
      if (url === '/api/related-systems') return { ok: true, json: async () => relatedSystems } as Response
      if (url === '/api/tickets') {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: 'VALIDATION_FAILED', fields: { categoryId: 'Category is required.' } }),
        } as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }))

    render(<CreateTicketForm requesterId={1} />)
    await screen.findByRole('heading', { name: 'Create Ticket' })

    fireEvent.change(screen.getByLabelText('Category *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Related System *'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Requested Priority *'), { target: { value: 'MEDIUM' } })
    fireEvent.change(screen.getByLabelText('Ticket Summary *'), { target: { value: 'Laptop battery drains quickly' } })
    fireEvent.change(screen.getByLabelText('Description *'), {
      target: { value: 'The battery drains much faster than it used to.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Category is required.')).toBeInTheDocument()
  })
})
