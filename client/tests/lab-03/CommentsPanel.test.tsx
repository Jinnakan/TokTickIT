import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommentsPanel } from '../../src/components/CommentsPanel.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CommentsPanel', () => {
  it('shows the empty state when there are no comments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))

    render(<CommentsPanel ticketId={42} />)

    await waitFor(() => {
      expect(screen.getByText('No comments yet.')).toBeInTheDocument()
    })
  })

  it('lists existing comments with author and body', async () => {
    const comments = [
      { id: 1, ticketId: 42, authorId: 3, authorName: 'Jennifer Anderson', body: 'Still happening.', createdAt: '2026-01-01T00:00:00.000Z' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => comments }))

    render(<CommentsPanel ticketId={42} />)

    await waitFor(() => {
      expect(screen.getByText('Still happening.')).toBeInTheDocument()
    })
    expect(screen.getByText('Jennifer Anderson')).toBeInTheDocument()
  })

  it('shows a safe failure state on load error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    render(<CommentsPanel ticketId={42} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to load comments.')
    })
  })

  it('posts a new comment and appends it to the list', async () => {
    const created = { id: 2, ticketId: 42, authorId: 3, authorName: 'Jennifer Anderson', body: 'New comment text', createdAt: '2026-01-02T00:00:00.000Z' }
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, status: 201, json: async () => created } as Response
      }
      return { ok: true, json: async () => [] } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<CommentsPanel ticketId={42} />)

    await waitFor(() => {
      expect(screen.getByText('No comments yet.')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'New comment text' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))

    await waitFor(() => {
      expect(screen.getByText('New comment text')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Add a comment')).toHaveValue('')
  })

  it('disables Post while the draft is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))

    render(<CommentsPanel ticketId={42} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled()
    })
  })
})
