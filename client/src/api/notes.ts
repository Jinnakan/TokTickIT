export type Note = {
  id: number
  ticketId: number
  authorId: number
  authorName: string
  body: string
  createdAt: string
}

export async function fetchNotes(ticketId: number, signal?: AbortSignal): Promise<Note[]> {
  const response = await fetch(`/api/tickets/${ticketId}/notes`, { credentials: 'include', signal })
  if (!response.ok) throw new Error('Unable to load internal notes.')
  return response.json() as Promise<Note[]>
}

export async function postNote(ticketId: number, body: string): Promise<Note> {
  const response = await fetch(`/api/tickets/${ticketId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ body }),
  })
  if (!response.ok) throw new Error('Unable to post the note.')
  return response.json() as Promise<Note>
}
