import { useCallback } from 'react'
import { fetchRequesterDashboard } from '../api/dashboard.js'
import { DashboardShell, MetricCard, Section, formatDate, useDashboard, type Navigate } from './DashboardParts.js'
import { StatusBadge } from './TicketBadges.js'

export function RequesterDashboard({
  firstName,
  onNavigate,
  onOpenTicket,
  refreshKey,
}: {
  firstName: string
  onNavigate: Navigate
  onOpenTicket: (ticketId: number) => void
  refreshKey: number
}) {
  const load = useCallback((signal: AbortSignal) => fetchRequesterDashboard(signal), [])
  const { data, state, announcement, reload } = useDashboard(load, refreshKey)

  return (
    <DashboardShell title={`Welcome, ${firstName}`} state={state} hasData={data !== null} announcement={announcement} onReload={reload}>
      {data && (
        <>
          <div className="row g-3 mb-4">
            {data.cards.map((card) => (
              <div key={card.key} className="col-12 col-sm-6 col-lg-3">
                <MetricCard card={card} onNavigate={onNavigate} />
              </div>
            ))}
          </div>

          <div className="row g-4">
            <div className="col-12 col-lg-6">
              <Section title="Recently updated" id="recently-updated">
                {data.recentlyUpdated.length === 0 ? (
                  <p className="text-body-secondary">No recent tickets yet.</p>
                ) : (
                  <ul className="list-group">
                    {data.recentlyUpdated.map((ticket) => (
                      <li key={ticket.id} className="list-group-item">
                        <button type="button" className="btn btn-link p-0 text-start" onClick={() => onOpenTicket(ticket.id)}>
                          {ticket.ticketNumber}: {ticket.summary}
                        </button>
                        <div className="d-flex gap-2 align-items-center small text-body-secondary">
                          <StatusBadge status={ticket.currentStatus} /> {formatDate(ticket.updatedAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className="btn btn-link p-0 mt-2" onClick={() => onNavigate('my-tickets')}>View all</button>
              </Section>
            </div>

            <div className="col-12 col-lg-6">
              <Section title="Recently resolved" id="recently-resolved">
                {data.recentlyResolved.length === 0 ? (
                  <p className="text-body-secondary">No recent tickets yet.</p>
                ) : (
                  <ul className="list-group">
                    {data.recentlyResolved.map((ticket) => (
                      <li key={ticket.id} className="list-group-item">
                        <button type="button" className="btn btn-link p-0 text-start" onClick={() => onOpenTicket(ticket.id)}>
                          {ticket.ticketNumber}: {ticket.summary}
                        </button>
                        <div className="d-flex gap-2 align-items-center small text-body-secondary">
                          <StatusBadge status={ticket.currentStatus} /> Resolved {formatDate(ticket.resolvedAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => onNavigate('create-ticket')}>Create Ticket</button>
            <button type="button" className="btn btn-outline-primary" onClick={() => onNavigate('my-tickets')}>View My Tickets</button>
          </div>
        </>
      )}
    </DashboardShell>
  )
}
