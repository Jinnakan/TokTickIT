import { useEffect, useState, type FormEvent } from 'react'
import { fetchNotes, postNote, type Note } from '../api/notes.js'

type Status = 'loading' | 'ready' | 'error'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Visually distinct from CommentsPanel on purpose (ui-spec.md §6.6) -- a
 * persistent label plus a different background tint, so an IT Staff
 * member can never mistake this panel for the one a Requester will see.
 */
export function NotesPanel({ ticketId }: { ticketId: number }) {
  const [status, setStatus] = useState<Status>('loading')
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [postError, setPostError] = useState('')

  useEffect(() => {
    let ignore = false
    setStatus('loading')

    fetchNotes(ticketId)
      .then((loaded) => {
        if (ignore) return
        setNotes(loaded)
        setStatus('ready')
      })
      .catch(() => {
        if (ignore) return
        setStatus('error')
      })

    return () => {
      ignore = true
    }
  }, [ticketId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPostError('')

    const body = draft.trim()
    if (!body) return

    setIsPosting(true)
    try {
      const created = await postNote(ticketId, body)
      setNotes((existing) => [...existing, created])
      setDraft('')
    } catch (error) {
      setPostError(error instanceof Error ? error.message : 'Unable to post the note.')
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <section
      className="mt-4 p-3 rounded"
      style={{ backgroundColor: 'var(--zg-pale-green, #EAF6EF)', border: '1px solid var(--zg-secondary, #0B7A46)' }}
      aria-labelledby="notes-heading"
    >
      <p className="fw-bold text-uppercase small mb-2" style={{ letterSpacing: '0.03em' }}>
        Internal Staff Notes — not visible to the Requester
      </p>
      <h2 id="notes-heading" className="h5 fw-bold mb-3">Internal Notes</h2>

      {status === 'loading' && (
        <p className="status-message text-body-secondary" role="status">
          <span aria-hidden="true">⌛</span> Loading notes…
        </p>
      )}

      {status === 'error' && (
        <div className="alert alert-danger" role="alert">
          Unable to load internal notes.
        </div>
      )}

      {status === 'ready' && notes.length === 0 && (
        <p className="text-body-secondary" role="status">No internal notes yet.</p>
      )}

      {status === 'ready' && notes.length > 0 && (
        <ul className="list-unstyled d-flex flex-column gap-3 mb-4">
          {notes.map((note) => (
            <li key={note.id} className="border rounded p-3 bg-white">
              <div className="d-flex justify-content-between mb-1">
                <strong>{note.authorName}</strong>
                <span className="small text-body-secondary">{formatDate(note.createdAt)}</span>
              </div>
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{note.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit}>
        <label htmlFor="new-note" className="form-label fw-semibold">
          Add an internal note
        </label>
        <textarea
          id="new-note"
          className="form-control mb-2"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={isPosting}
        />
        {postError && (
          <div className="alert alert-danger" role="alert">
            {postError}
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={isPosting || draft.trim() === ''}>
          {isPosting ? 'Posting…' : 'Post'}
        </button>
      </form>
    </section>
  )
}
