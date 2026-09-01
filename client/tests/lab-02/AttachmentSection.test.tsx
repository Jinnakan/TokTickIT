import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AttachmentSection } from '../../src/components/AttachmentSection.js'

const activeAttachment = {
  id: 1,
  originalFilename: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2048,
  uploadedAt: '2026-01-01T00:00:00.000Z',
  isRemoved: false,
  removedAt: null,
  removedReason: null,
}

const removedAttachment = {
  ...activeAttachment,
  id: 2,
  originalFilename: 'old-screenshot.png',
  isRemoved: true,
  removedAt: '2026-01-02T00:00:00.000Z',
  removedReason: 'Uploaded the wrong file',
}

function stubFetch(attachments: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/tickets/42/attachments' && (!init || init.method === undefined)) {
      return { ok: true, json: async () => attachments } as Response
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AttachmentSection', () => {
  it('shows removed-attachment metadata but no download control for it (AC-13)', async () => {
    stubFetch([removedAttachment])

    render(<AttachmentSection ticketId={42} requesterId={1} />)

    expect(await screen.findByText('old-screenshot.png')).toBeInTheDocument()
    expect(screen.getByText(/Uploaded the wrong file/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
    expect(screen.getByText('Removed')).toBeInTheDocument()
  })

  it('blocks removal submission until a reason is provided (AC-14)', async () => {
    stubFetch([activeAttachment])

    render(<AttachmentSection ticketId={42} requesterId={1} />)

    const removeButton = await screen.findByRole('button', { name: 'Remove' })
    fireEvent.click(removeButton)

    const confirmButton = screen.getByRole('button', { name: 'Confirm Removal' })
    fireEvent.click(confirmButton)

    expect(await screen.findByText('Provide a reason (3-200 characters).')).toBeInTheDocument()
  })

  it('rejects a disallowed file type client-side without calling the upload API', async () => {
    stubFetch([])
    render(<AttachmentSection ticketId={42} requesterId={1} />)

    const fileInput = await screen.findByLabelText('Add attachment')
    const badFile = new File(['not an image'], 'malware.exe', { type: 'application/octet-stream' })

    fireEvent.change(fileInput, { target: { files: [badFile] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Allowed types:')
    })
  })
})
