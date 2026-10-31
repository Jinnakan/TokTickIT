import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppearsResolved } from '../../src/components/tickets/AppearsResolved.js'
import { ChangePassword } from '../../src/components/auth/ChangePassword.js'
import { CommentsPanel } from '../../src/components/tickets/CommentsPanel.js'
import { CreateTicketForm } from '../../src/components/tickets/CreateTicketForm.js'
import { Login } from '../../src/components/auth/Login.js'
import { NotesPanel } from '../../src/components/tickets/NotesPanel.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A fetch stub that answers reads quickly and holds every write open until released, counting them. */
function stubWrites(isWrite: (url: string, method: string) => boolean, answer: unknown = {}) {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  const writes: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (isWrite(url, method)) {
      writes.push(`${method} ${url}`)
      await gate
      return { ok: true, status: 200, json: async () => answer } as Response
    }
    if (url === '/api/categories' || url === '/api/related-systems') {
      return { ok: true, status: 200, json: async () => [{ id: 1, name: 'Hardware' }] } as Response
    }
    return { ok: true, status: 200, json: async () => [] } as Response
  }))
  return { writes, release }
}

function submitThrice(form: HTMLElement) {
  act(() => {
    fireEvent.submit(form)
    fireEvent.submit(form)
    fireEvent.submit(form)
  })
}

describe('Repeated submits send one request (FR-L4-18, AC-L4-28)', () => {
  it('Login', async () => {
    const { writes, release } = stubWrites((url, method) => method === 'POST' && url === '/api/auth/login', { id: 1 })
    const { container } = render(<Login onLoggedIn={() => {}} />)
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'alex.rivera@toktickit.test' } })
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'DevPass123!' } })
    submitThrice(container.querySelector('form') as HTMLElement)
    release()
    await waitFor(() => expect(writes.length).toBeGreaterThan(0))
    expect(writes).toHaveLength(1)
  })

  it('Change Password', async () => {
    const { writes, release } = stubWrites((url, method) => method === 'POST' && url.includes('/api/auth/'), { success: true })
    const { container } = render(<ChangePassword mandatory onChanged={() => {}} />)
    fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'DevPass123!' } })
    fireEvent.change(screen.getByLabelText('New Password *', { exact: true }), { target: { value: 'BrandNewPass456!' } })
    fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'BrandNewPass456!' } })
    submitThrice(container.querySelector('form') as HTMLElement)
    release()
    await waitFor(() => expect(writes.length).toBeGreaterThan(0))
    expect(writes).toHaveLength(1)
  })

  it('Public Comment', async () => {
    const { writes, release } = stubWrites((url, method) => method === 'POST' && url.endsWith('/comments'), {
      id: 1, ticketId: 42, authorId: 1, authorName: 'A', body: 'Hello', createdAt: '2026-01-01T00:00:00.000Z',
    })
    const { container } = render(<CommentsPanel ticketId={42} />)
    const box = await waitFor(() => {
      const element = container.querySelector('#new-comment') as HTMLTextAreaElement | null
      if (!element) throw new Error('not ready')
      return element
    })
    fireEvent.change(box, { target: { value: 'Hello' } })
    submitThrice(container.querySelector('form') as HTMLElement)
    release()
    await waitFor(() => expect(writes.length).toBeGreaterThan(0))
    expect(writes).toHaveLength(1)
  })

  it('Internal Note', async () => {
    const { writes, release } = stubWrites((url, method) => method === 'POST' && url.endsWith('/notes'), {
      id: 1, ticketId: 42, authorId: 1, authorName: 'A', body: 'Note', createdAt: '2026-01-01T00:00:00.000Z',
    })
    const { container } = render(<NotesPanel ticketId={42} />)
    const box = await waitFor(() => {
      const element = container.querySelector('#new-note') as HTMLTextAreaElement | null
      if (!element) throw new Error('not ready')
      return element
    })
    fireEvent.change(box, { target: { value: 'Note' } })
    submitThrice(container.querySelector('form') as HTMLElement)
    release()
    await waitFor(() => expect(writes.length).toBeGreaterThan(0))
    expect(writes).toHaveLength(1)
  })

  it('Create Ticket', async () => {
    const { writes, release } = stubWrites((url, method) => method === 'POST' && url === '/api/tickets', {
      id: 1, ticketNumber: 'TKT-2026-000001',
    })
    const { container } = render(<CreateTicketForm requesterName="Sarah Johnson" onViewMyTickets={() => {}} />)
    await waitFor(() => expect(container.querySelectorAll('#ticket-category option').length).toBeGreaterThan(1))
    fireEvent.change(container.querySelector('#ticket-category') as HTMLSelectElement, { target: { value: '1' } })
    fireEvent.change(container.querySelector('#ticket-related-system') as HTMLSelectElement, { target: { value: '1' } })
    fireEvent.change(container.querySelector('#ticket-priority') as HTMLSelectElement, { target: { value: 'MEDIUM' } })
    fireEvent.change(container.querySelector('#ticket-summary') as HTMLInputElement, { target: { value: 'Laptop will not start' } })
    fireEvent.change(container.querySelector('#ticket-description') as HTMLTextAreaElement, { target: { value: 'It does not power on at all.' } })
    submitThrice(container.querySelector('form') as HTMLElement)
    release()
    await waitFor(() => expect(writes.length).toBeGreaterThan(0))
    expect(writes).toHaveLength(1)
  })

  it('Problem appears resolved', async () => {
    const { writes, release } = stubWrites((url, method) => method === 'POST' && url.endsWith('/appears-resolved'), {
      id: 42, requesterResolvedAt: '2026-10-31T09:00:00.000Z', currentStatus: 'IN_PROGRESS',
    })
    render(<AppearsResolved ticketId={42} status="IN_PROGRESS" requesterResolvedAt={null} />)
    const button = screen.getByRole('button', { name: 'Problem appears resolved' })
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)
    })
    release()
    await waitFor(() => expect(writes.length).toBeGreaterThan(0))
    expect(writes).toHaveLength(1)
  })
})
