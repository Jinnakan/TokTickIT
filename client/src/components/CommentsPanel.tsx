import { useEffect, useState, type FormEvent } from 'react'
import { fetchComments, postComment, type Comment } from '../api/comments.js'

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

export function CommentsPanel({ ticketId }: { ticketId: number }) {
  const [status, setStatus] = useState<Status>('loading')
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [postError, setPostError] = useState('')

  useEffect(() => {
    let ignore = false
    setStatus('loading')

    fetchComments(ticketId)
      .then((loaded) => {
        if (ignore) return
        setComments(loaded)
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
      const created = await postComment(ticketId, body)
      setComments((existing) => [...existing, created])
      setDraft('')
    } catch (error) {
      setPostError(error instanceof Error ? error.message : 'Unable to post the comment.')
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <section className="mt-4" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="h5 fw-bold mb-3">Comments</h2>

      {status === 'loading' && (
        <p className="status-message text-body-secondary" role="status">
          <span aria-hidden="true">⌛</span> Loading comments…
        </p>
      )}

      {status === 'error' && (
        <div className="alert alert-danger" role="alert">
          Unable to load comments.
        </div>
      )}

      {status === 'ready' && comments.length === 0 && (
        <p className="text-body-secondary" role="status">No comments yet.</p>
      )}

      {status === 'ready' && comments.length > 0 && (
        <ul className="list-unstyled d-flex flex-column gap-3 mb-4">
          {comments.map((comment) => (
            <li key={comment.id} className="border rounded p-3">
              <div className="d-flex justify-content-between mb-1">
                <strong>{comment.authorName}</strong>
                <span className="small text-body-secondary">{formatDate(comment.createdAt)}</span>
              </div>
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit}>
        <label htmlFor="new-comment" className="form-label fw-semibold">
          Add a comment
        </label>
        <textarea
          id="new-comment"
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
