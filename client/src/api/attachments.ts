import type { Attachment } from '../types/attachment.js'

export class AttachmentUploadError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export async function fetchAttachments(ticketId: number, signal?: AbortSignal): Promise<Attachment[]> {
  const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    throw new Error('Unable to load attachments.')
  }

  return response.json() as Promise<Attachment[]>
}

export async function uploadAttachment(ticketId: number, file: File): Promise<Attachment> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; message?: string }
    throw new AttachmentUploadError(body.error ?? 'UPLOAD_FAILED', body.message ?? 'Unable to upload the file.')
  }

  return response.json() as Promise<Attachment>
}

export async function removeAttachment(attachmentId: number, reason: string): Promise<Attachment> {
  const response = await fetch(`/api/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; message?: string }
    throw new AttachmentUploadError(body.error ?? 'REMOVE_FAILED', body.message ?? 'Unable to remove the attachment.')
  }

  return response.json() as Promise<Attachment>
}

/** Fetches the file (with the session cookie) and triggers a normal browser save. */
export async function downloadAttachment(attachmentId: number, filename: string): Promise<void> {
  const response = await fetch(`/api/attachments/${attachmentId}/download`, {
    credentials: 'include',
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
