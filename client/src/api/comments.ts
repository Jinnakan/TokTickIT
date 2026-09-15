export type Comment = {
  id: number
  ticketId: number
  authorId: number
  authorName: string
  body: string
  createdAt: string
}

export class CommentValidationError extends Error {
  fields: Record<string, string>

  constructor(fields: Record<string, string>) {
    super('Comment validation failed.')
    this.fields = fields
  }
}

export async function fetchComments(ticketId: number, signal?: AbortSignal): Promise<Comment[]> {
  const response = await fetch(`/api/tickets/${ticketId}/comments`, {
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    throw new Error('Unable to load comments.')
  }

  return response.json() as Promise<Comment[]>
}

export async function postComment(ticketId: number, body: string): Promise<Comment> {
  const response = await fetch(`/api/tickets/${ticketId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ body }),
  })

  if (response.status === 400) {
    const responseBody = (await response.json()) as { error: string; fields?: Record<string, string> }
    if (responseBody.error === 'VALIDATION_FAILED' && responseBody.fields) {
      throw new CommentValidationError(responseBody.fields)
    }
    throw new Error('Unable to post the comment.')
  }

  if (!response.ok) {
    throw new Error('Unable to post the comment.')
  }

  return response.json() as Promise<Comment>
}
