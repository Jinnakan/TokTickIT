import { useEffect, useState } from 'react'
import { STATUS_LABELS } from '@toktickit/shared'
import { fetchHistory, type HistoryRow } from '../../api/history.js'
import { formatDateTime as formatDate } from '../../lib/format.js'

/** Collapsed, read-only status history, oldest first (ui-spec §5). Refetches quietly when the Ticket version changes. */
export function HistoryPanel({ ticketId, ticketVersion }: { ticketId: number; ticketVersion?: number }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let ignore = false
    fetchHistory(ticketId)
      .then((loaded) => {
        if (ignore) return
        setRows(loaded)
        setFailed(false)
      })
      .catch(() => {
        if (!ignore) setFailed(true)
      })
    return () => {
      ignore = true
    }
  }, [ticketId, ticketVersion])

  return (
    <details className="mt-4">
      <summary className="h6 fw-bold">History</summary>
      {failed && <p className="text-danger small mt-2" role="alert">Unable to load the history.</p>}
      {!failed && rows === null && <p className="text-body-secondary small mt-2" role="status">Loading history…</p>}
      {rows && (
        <ol className="list-unstyled mt-2 mb-0">
          {rows.map((row) => (
            <li key={row.id} className="small py-1 border-bottom">
              <strong>
                {row.fromStatus ? `${STATUS_LABELS[row.fromStatus]} → ${STATUS_LABELS[row.toStatus]}` : `Created as ${STATUS_LABELS[row.toStatus]}`}
              </strong>
              {' · '}
              {row.changedByName ?? 'System'}
              {' · '}
              <span className="text-body-secondary">{formatDate(row.changedAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}
