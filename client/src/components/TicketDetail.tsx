import { useEffect, useState } from 'react'
import { fetchActiveCategories, fetchActiveRelatedSystems, type ReferenceItem } from '../api/referenceData.js'
import { fetchTicket, TicketAccessError } from '../api/tickets.js'
import type { Ticket } from '../types/ticket.js'
import { PriorityBadge, StatusBadge } from './TicketBadges.js'
import { AttachmentSection } from './AttachmentSection.js'

type Status = 'loading' | 'ready' | 'not-found' | 'forbidden' | 'error'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function TicketDetail({
  ticketId,
  requesterId,
  onBackToMyTickets,
}: {
  ticketId: number
  requesterId: number
  onBackToMyTickets: () => void
}) {
  const [status, setStatus] = useState<Status>('loading')
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [categories, setCategories] = useState<ReferenceItem[]>([])
  const [relatedSystems, setRelatedSystems] = useState<ReferenceItem[]>([])

  useEffect(() => {
    let ignore = false
    setStatus('loading')

    Promise.all([
      fetchTicket(ticketId, requesterId),
      fetchActiveCategories(),
      fetchActiveRelatedSystems(),
    ])
      .then(([loadedTicket, loadedCategories, loadedRelatedSystems]) => {
        if (ignore) return
        setTicket(loadedTicket)
        setCategories(loadedCategories)
        setRelatedSystems(loadedRelatedSystems)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (ignore) return
        if (error instanceof TicketAccessError) {
          setStatus(error.status === 404 ? 'not-found' : 'forbidden')
        } else {
          setStatus('error')
        }
      })

    return () => {
      ignore = true
    }
  }, [ticketId, requesterId])

  if (status === 'loading') {
    return (
      <p className="status-message text-body-secondary" role="status">
        <span aria-hidden="true">⌛</span> Loading ticket…
      </p>
    )
  }

  if (status === 'not-found' || status === 'forbidden') {
    return (
      <div className="alert alert-warning" role="alert">
        <strong>{status === 'not-found' ? 'Ticket not found.' : 'You do not have access to this ticket.'}</strong>
        <div className="mt-3">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onBackToMyTickets}>
            Back to My Tickets
          </button>
        </div>
      </div>
    )
  }

  if (status === 'error' || !ticket) {
    return (
      <div className="alert alert-danger" role="alert">
        Unable to load this ticket. Start the backend and check the database connection.
      </div>
    )
  }

  const categoryName = categories.find((category) => category.id === ticket.categoryId)?.name ?? '—'
  const relatedSystemName = relatedSystems.find((system) => system.id === ticket.relatedSystemId)?.name ?? '—'

  return (
    <div>
      <nav aria-label="breadcrumb" className="mb-3">
        <button type="button" className="btn btn-link p-0" onClick={onBackToMyTickets}>
          ← Back to My Tickets
        </button>
      </nav>

      <div className="card shadow-sm">
        <div className="card-body">
          <h1 className="h4 fw-bold mb-4">Ticket {ticket.ticketNumber}</h1>

          <div className="row g-3 mb-3">
            <ReadOnlyField label="Ticket Number" value={ticket.ticketNumber} />
            <ReadOnlyField label="Ticket Date" value={formatDate(ticket.createdAt)} />
            <ReadOnlyField label="Category" value={categoryName} />
            <ReadOnlyField label="Related System" value={relatedSystemName} />
          </div>

          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <div className="form-label fw-semibold mb-1">Requested Priority</div>
              <PriorityBadge priority={ticket.requestedPriority} />
            </div>
            <div className="col-md-6">
              <div className="form-label fw-semibold mb-1">Current Status</div>
              <StatusBadge status={ticket.currentStatus} />
            </div>
          </div>

          <div className="mb-3">
            <div className="form-label fw-semibold mb-1">Summary</div>
            <p className="border rounded p-2 field-readonly mb-0">{ticket.summary}</p>
          </div>

          <div>
            <div className="form-label fw-semibold mb-1">Description</div>
            <p className="border rounded p-2 field-readonly mb-0" style={{ whiteSpace: 'pre-wrap' }}>
              {ticket.description}
            </p>
          </div>
        </div>
      </div>

      <AttachmentSection ticketId={ticket.id} requesterId={requesterId} />
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-md-6">
      <div className="form-label fw-semibold mb-1">{label}</div>
      <div className="form-control field-readonly" aria-readonly="true">
        {value}
      </div>
    </div>
  )
}
