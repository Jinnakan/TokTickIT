import type { Attachment } from '../types/attachment.js'
import { devRequesterHeaders } from './http.js'

export class AttachmentUploadError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export async function fetchAttachments(ticketId: number, requesterId: number, signal?: AbortSignal): Promise<Attachment[]> {
  const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
    headers: devRequesterHeaders(requesterId),
    signal,
  })

  if (!response.ok) {
    throw new Error('Unable to load attachments.')
  }

  return response.json() as Promise<Attachment[]>
}

export async function uploadAttachment(ticketId: number, file: File, requesterId: number): Promise<Attachment> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
    method: 'POST',
    headers: devRequesterHeaders(requesterId),
    body: formData,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; message?: string }
    throw new AttachmentUploadError(body.error ?? 'UPLOAD_FAILED', body.message ?? 'Unable to upload the file.')
  }

  return response.json() as Promise<Attachment>
}

export async function removeAttachment(attachmentId: number, reason: string, requesterId: number): Promise<Attachment> {
  const response = await fetch(`/api/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...devRequesterHeaders(requesterId),
    },
    body: JSON.stringify({ reason }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; message?: string }
    throw new AttachmentUploadError(body.error ?? 'REMOVE_FAILED', body.message ?? 'Unable to remove the attachment.')
  }

  return response.json() as Promise<Attachment>
}

/** Fetches the file (with the required header) and triggers a normal browser save. */
export async function downloadAttachment(attachmentId: number, filename: string, requesterId: number): Promise<void> {
  const response = await fetch(`/api/attachments/${attachmentId}/download`, {
    headers: devRequesterHeaders(requesterId),
  })

  if (!response.ok) {
    throw new Error('Unable to download the attachment.')
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}
