import { useEffect, useMemo, useState } from 'react'
import { fetchActiveCategories, fetchActiveRelatedSystems, type ReferenceItem } from '../api/referenceData.js'
import { fetchStaffTicketDetail } from '../api/staffTicketDetail.js'
import type { StaffTicketDetail as StaffTicketDetailType } from '../types/ticket.js'
import { PriorityBadge, StatusBadge } from './TicketBadges.js'
import { AttachmentSection } from './AttachmentSection.js'
import { CommentsPanel } from './CommentsPanel.js'
import { NotesPanel } from './NotesPanel.js'
import { ServiceActionsPanel } from './ServiceActionsPanel.js'
import { TicketDetailMediator } from '../staff/ticket-detail-mediator.js'

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

export function StaffTicketDetail({
  ticketId,
  currentUserId,
  onBackToQueue,
}: {
  ticketId: number
  currentUserId: number
  onBackToQueue: () => void
}) {
  const [status, setStatus] = useState<Status>('loading')
  const [ticket, setTicket] = useState<StaffTicketDetailType | null>(null)
  const [categories, setCategories] = useState<ReferenceItem[]>([])
  const [relatedSystems, setRelatedSystems] = useState<ReferenceItem[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let ignore = false
    setStatus('loading')

    Promise.all([fetchStaffTicketDetail(ticketId), fetchActiveCategories(), fetchActiveRelatedSystems()])
      .then(([loadedTicket, loadedCategories, loadedRelatedSystems]) => {
        if (ignore) return
        setTicket(loadedTicket)
        setCategories(loadedCategories)
        setRelatedSystems(loadedRelatedSystems)
        setStatus('ready')
      })
      .catch(() => {
        if (ignore) return
        setStatus('error')
      })

    return () => {
      ignore = true
    }
  }, [ticketId, reloadToken])

  const mediator = useMemo(
    () => new TicketDetailMediator(() => setReloadToken((token) => token + 1)),
    [],
  )

  if (status === 'loading') {
    return (
      <p className="status-message text-body-secondary" role="status">
        <span aria-hidden="true">⌛</span> Loading ticket…
      </p>
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
        <button type="button" className="btn btn-link p-0" onClick={onBackToQueue}>
          ← Ticket Queue
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
            <ReadOnlyField label="Requester" value={ticket.requester.name} />
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

      <ServiceActionsPanel ticket={ticket} currentUserId={currentUserId} mediator={mediator} />
      <AttachmentSection ticketId={ticket.id} />
      <CommentsPanel ticketId={ticket.id} />
      <NotesPanel ticketId={ticket.id} />
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
