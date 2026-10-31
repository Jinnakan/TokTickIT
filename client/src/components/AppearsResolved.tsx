import { useState } from 'react'
import { markAppearsResolved } from '../api/tickets.js'
import type { TicketStatus } from '../types/ticket.js'

const APPLICABLE: readonly TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED']

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Requester-only, advisory: never changes the Ticket status (BR-L4-12). */
export function AppearsResolved({
  ticketId,
  status,
  requesterResolvedAt,
}: {
  ticketId: number
  status: TicketStatus
  requesterResolvedAt: string | null | undefined
}) {
  const [resolvedAt, setResolvedAt] = useState<string | null>(requesterResolvedAt ?? null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')

  if (resolvedAt) {
    return <p className="mt-3 mb-0" role="status">You told us this appears resolved on {formatDate(resolvedAt)}.</p>
  }
  if (!APPLICABLE.includes(status)) return null

  async function handleClick() {
    setError('')
    setIsSending(true)
    try {
      const result = await markAppearsResolved(ticketId)
      setResolvedAt(result.requesterResolvedAt)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send that. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="mt-3">
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button type="button" className="btn btn-outline-primary" disabled={isSending} onClick={() => void handleClick()}>
        {isSending ? 'Sending…' : 'Problem appears resolved'}
      </button>
    </div>
  )
}
