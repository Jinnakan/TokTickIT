import { useCallback } from 'react'
import { PRIORITY_LABELS, ROLE_LABELS, STATUS_LABELS } from '@toktickit/shared'
import { fetchStaffDashboard } from '../../api/dashboard.js'
import { DashboardShell, MetricCard, Section, followDrillDown, formatDate, useDashboard, type Navigate } from './DashboardParts.js'
import { StatusBadge } from '../common/TicketBadges.js'

export function StaffDashboard({
  role,
  firstName,
  onNavigate,
  onOpenTicket,
  refreshKey,
}: {
  role: 'IT_STAFF' | 'ADMINISTRATOR'
  firstName: string
  onNavigate: Navigate
  onOpenTicket: (ticketId: number) => void
  refreshKey: number
}) {
  const load = useCallback((signal: AbortSignal) => fetchStaffDashboard(signal), [])
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
              <Section title="By status" id="by-status">
                <ul className="list-group">
                  {data.byStatus.map((row) => (
                    <li key={row.status} className="list-group-item p-0">
                      <a
                        href={`#status-${row.status}`}
                        className="d-flex justify-content-between align-items-center px-3 py-2 text-decoration-none text-reset"
                        aria-label={`${STATUS_LABELS[row.status]}, ${row.count} ${row.count === 1 ? 'ticket' : 'tickets'}`}
                        onClick={(event) => {
                          event.preventDefault()
                          followDrillDown(row.drillDown, onNavigate)
                        }}
                      >
                        <StatusBadge status={row.status} />
                        <strong>{row.count}</strong>
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>

            <div className="col-12 col-lg-6">
              <Section title="By IT Priority" id="by-priority">
                <ul className="list-group">
                  {[...data.byItPriority].reverse().map((row) => (
                    <li key={row.priority} className="list-group-item p-0">
                      <a
                        href={`#priority-${row.priority}`}
                        className="d-flex justify-content-between align-items-center px-3 py-2 text-decoration-none text-reset"
                        aria-label={`${PRIORITY_LABELS[row.priority]} priority, ${row.count} ${row.count === 1 ? 'ticket' : 'tickets'}`}
                        onClick={(event) => {
                          event.preventDefault()
                          followDrillDown(row.drillDown, onNavigate)
                        }}
                      >
                        <span>{PRIORITY_LABELS[row.priority]}</span>
                        <strong>{row.count}</strong>
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>

              {role === 'ADMINISTRATOR' && data.users && (
                <Section title="Users" id="users-strip">
                  <button type="button" className="btn btn-outline-secondary w-100 text-start" onClick={() => onNavigate('user-management')}>
                    {data.users.active} active · {data.users.inactive} inactive ·{' '}
                    {(['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const).map((key) => `${data.users!.byRole[key]} ${ROLE_LABELS[key]}`).join(' · ')}
                  </button>
                </Section>
              )}
            </div>
          </div>

          <div className="row g-4">
            <div className="col-12 col-lg-6">
              <Section title="My open actions" id="my-open-actions">
                {data.myActions.length === 0 ? (
                  <p className="text-body-secondary">Nothing planned for you.</p>
                ) : (
                  <ul className="list-group">
                    {data.myActions.map((action) => (
                      <li key={action.actionId} className="list-group-item">
                        <button type="button" className="btn btn-link p-0 text-start" onClick={() => onOpenTicket(action.ticketId)}>
                          {action.ticketNumber}: {action.description}
                        </button>
                        <div className="small text-body-secondary">{action.status === 'IN_PROGRESS' ? 'In Progress' : 'Planned'} · {formatDate(action.actionAt)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

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
                        <div className="d-flex flex-wrap gap-2 align-items-center small text-body-secondary">
                          <StatusBadge status={ticket.currentStatus} />
                          {ticket.ticketOwnerName ?? 'Unassigned'} · {formatDate(ticket.updatedAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  )
}
