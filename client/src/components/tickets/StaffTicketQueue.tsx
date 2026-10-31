import { useEffect, useRef, useState } from 'react'
import { fetchActiveCategories, type ReferenceItem } from '../../api/referenceData.js'
import { fetchStaffTicketQueue } from '../../api/staffTickets.js'
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TICKET_STATUSES,
  STATUS_LABELS,
} from '@toktickit/shared'
import type {
  Priority,
  SortDirection,
  StaffTicketListItem,
  TicketListMeta,
  TicketSortField,
  TicketStatus,
} from '../../types/ticket.js'
import { PriorityBadge, RequesterReportedBadge, StatusBadge } from '../common/TicketBadges.js'
import { describeFilters, type ListFilters } from '../../nav/app-navigation.js'
import { formatDateTime as formatDate } from '../../lib/format.js'

type ListStatus = 'loading' | 'ready' | 'error'

const COLUMNS: { field: TicketSortField; label: string }[] = [
  { field: 'ticketNumber', label: 'Ticket No.' },
  { field: 'createdAt', label: 'Last Updated' },
  { field: 'summary', label: 'Summary' },
]

export type QueueSnapshot = {
  search: string
  categoryId: string
  requestedPriority: Priority | ''
  itPriority: Priority | ''
  currentStatus: TicketStatus | ''
  unassignedOnly: boolean
  statusGroup: string
  ownerId: string
  reportedResolved: boolean
  sortBy: TicketSortField
  sortDir: SortDirection
  page: number
}

export function StaffTicketQueue({
  currentUserId,
  onOpenTicket,
  initialFilters = {},
  refreshKey = 0,
  snapshot,
  onSnapshot,
}: {
  currentUserId: number
  onOpenTicket: (ticketId: number) => void
  initialFilters?: ListFilters
  refreshKey?: number
  /** What the screen looked like when a Ticket was opened, so Back restores filters, page and search. */
  snapshot?: QueueSnapshot
  onSnapshot?: (snapshot: QueueSnapshot) => void
}) {
  const [categories, setCategories] = useState<ReferenceItem[]>([])

  const [search, setSearch] = useState(snapshot?.search ?? '')
  const [categoryId, setCategoryId] = useState(snapshot?.categoryId ?? '')
  const [requestedPriority, setRequestedPriority] = useState<Priority | ''>(snapshot?.requestedPriority ?? '')
  const [itPriority, setItPriority] = useState<Priority | ''>(snapshot?.itPriority ?? (initialFilters.itPriority as Priority | undefined) ?? '')
  const [currentStatus, setCurrentStatus] = useState<TicketStatus | ''>(snapshot?.currentStatus ?? (initialFilters.currentStatus as TicketStatus | undefined) ?? '')
  const [unassignedOnly, setUnassignedOnly] = useState(snapshot?.unassignedOnly ?? initialFilters.unassignedOnly === 'true')
  // Drill-down filters from a dashboard have no control of their own; "Showing:" names them and Clear Filters drops them.
  const [statusGroup, setStatusGroup] = useState(snapshot?.statusGroup ?? initialFilters.statusGroup ?? '')
  const [ownerId, setOwnerId] = useState(snapshot?.ownerId ?? initialFilters.ticketOwnerId ?? '')
  const [reportedResolved, setReportedResolved] = useState(snapshot?.reportedResolved ?? initialFilters.requesterReportedResolved === 'true')
  const lastRefresh = useRef(refreshKey)
  const [sortBy, setSortBy] = useState<TicketSortField>(snapshot?.sortBy ?? 'createdAt')
  const [sortDir, setSortDir] = useState<SortDirection>(snapshot?.sortDir ?? 'desc')
  const [page, setPage] = useState(snapshot?.page ?? 1)

  const [status, setStatus] = useState<ListStatus>('loading')
  const [tickets, setTickets] = useState<StaffTicketListItem[]>([])
  const [meta, setMeta] = useState<TicketListMeta | null>(null)

  useEffect(() => {
    onSnapshot?.({ search, categoryId, requestedPriority, itPriority, currentStatus, unassignedOnly, statusGroup, ownerId, reportedResolved, sortBy, sortDir, page })
  }, [search, categoryId, requestedPriority, itPriority, currentStatus, unassignedOnly, statusGroup, ownerId, reportedResolved, sortBy, sortDir, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasActiveFilters =
    search !== '' || categoryId !== '' || requestedPriority !== '' || itPriority !== '' || currentStatus !== '' || unassignedOnly || statusGroup !== '' || ownerId !== '' || reportedResolved

  useEffect(() => {
    fetchActiveCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let ignore = false
    // Coming back from a Ticket refetches quietly: the rows stay while fresh data loads.
    const refreshOnly = lastRefresh.current !== refreshKey
    lastRefresh.current = refreshKey
    if (!refreshOnly) setStatus('loading')

    fetchStaffTicketQueue(
      {
        search: search || undefined,
        categoryId: categoryId === '' ? undefined : Number(categoryId),
        requestedPriority: requestedPriority || undefined,
        itPriority: itPriority || undefined,
        currentStatus: currentStatus || undefined,
        unassignedOnly: unassignedOnly || undefined,
        statusGroup: statusGroup || undefined,
        ticketOwnerId: ownerId === '' ? undefined : Number(ownerId),
        requesterReportedResolved: reportedResolved || undefined,
        sortBy,
        sortDir,
        page,
      },
      controller.signal,
    )
      .then((result) => {
        if (ignore) return
        setTickets(result.data)
        setMeta(result.meta)
        setStatus('ready')
      })
      .catch(() => {
        if (ignore) return
        setStatus('error')
      })

    return () => {
      ignore = true
      controller.abort()
    }
  }, [search, categoryId, requestedPriority, itPriority, currentStatus, unassignedOnly, statusGroup, ownerId, reportedResolved, sortBy, sortDir, page, refreshKey])

  const drillParts = describeFilters(
    { statusGroup, ticketOwnerId: ownerId, requesterReportedResolved: reportedResolved ? 'true' : '' },
    currentUserId,
  )

  function handleClearFilters() {
    setSearch('')
    setCategoryId('')
    setRequestedPriority('')
    setItPriority('')
    setCurrentStatus('')
    setUnassignedOnly(false)
    setStatusGroup('')
    setOwnerId('')
    setReportedResolved(false)
    setPage(1)
  }

  function handleSort(field: TicketSortField) {
    if (field === sortBy) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(1)
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h1 className="h4 fw-bold mb-1">Ticket Queue</h1>
          <p className="text-body-secondary mb-0">Tickets from every Requester.</p>
          {drillParts.length > 0 && (
            <p className="small mb-0" role="status">Showing: {drillParts.join(' · ')}</p>
          )}
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClearFilters}>
          Clear Filters
        </button>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-12 col-lg-5">
          <input
            type="search"
            className="form-control"
            placeholder="Search by ticket number or summary…"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            aria-label="Search tickets"
          />
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <select
            className="form-select"
            value={categoryId}
            onChange={(event) => { setCategoryId(event.target.value); setPage(1) }}
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-sm-6 col-lg-4">
          <select
            className="form-select"
            value={requestedPriority}
            onChange={(event) => { setRequestedPriority(event.target.value as Priority | ''); setPage(1) }}
            aria-label="Filter by requested priority"
          >
            <option value="">All Requested Priorities</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-sm-6 col-lg-4">
          <select
            className="form-select"
            value={itPriority}
            onChange={(event) => { setItPriority(event.target.value as Priority | ''); setPage(1) }}
            aria-label="Filter by IT priority"
          >
            <option value="">All IT Priorities</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-sm-6 col-lg-4">
          <select
            className="form-select"
            value={currentStatus}
            onChange={(event) => { setCurrentStatus(event.target.value as TicketStatus | ''); setPage(1) }}
            aria-label="Filter by current status"
          >
            <option value="">All Statuses</option>
            {TICKET_STATUSES.map((statusValue) => (
              <option key={statusValue} value={statusValue}>{STATUS_LABELS[statusValue]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-check mb-3">
        <input
          type="checkbox"
          className="form-check-input"
          id="unassigned-only"
          checked={unassignedOnly}
          onChange={(event) => { setUnassignedOnly(event.target.checked); setPage(1) }}
        />
        <label className="form-check-label" htmlFor="unassigned-only">Unassigned only</label>
      </div>

      {status === 'loading' && (
        <p className="status-message text-body-secondary" role="status">
          <span aria-hidden="true">⌛</span> Loading tickets…
        </p>
      )}

      {status === 'error' && (
        <div className="alert alert-danger" role="alert">
          <strong>Unable to load the ticket queue.</strong>
          <br />
          Start the backend and check the database connection.
        </div>
      )}

      {status === 'ready' && tickets.length === 0 && !hasActiveFilters && (
        <div className="alert alert-secondary" role="status">No tickets in the queue yet.</div>
      )}

      {status === 'ready' && tickets.length === 0 && hasActiveFilters && (
        <div className="alert alert-secondary" role="status">
          No tickets match your filters.{' '}
          <button type="button" className="btn btn-link p-0 align-baseline" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>
      )}

      {status === 'ready' && tickets.length > 0 && (
        <>
          <div className="table-responsive d-none d-md-block">
            <table className="table align-middle">
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column.field} role="columnheader" style={{ cursor: 'pointer' }} onClick={() => handleSort(column.field)}>
                      {column.label}
                      {sortBy === column.field && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                  ))}
                  <th className="d-none d-lg-table-cell">Requester</th>
                  <th className="d-none d-lg-table-cell">Category</th>
                  <th className="d-none d-lg-table-cell">Requested Priority</th>
                  <th>IT Priority</th>
                  <th>Current Status</th>
                  <th className="d-none d-lg-table-cell">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onOpenTicket(ticket.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onOpenTicket(ticket.id)
                      }
                    }}
                  >
                    <td>{ticket.ticketNumber}</td>
                    <td>{formatDate(ticket.updatedAt)}</td>
                    <td>{ticket.summary}</td>
                    <td className="d-none d-lg-table-cell">{ticket.requester.name}</td>
                    <td className="d-none d-lg-table-cell">
                      {categories.find((category) => category.id === ticket.categoryId)?.name ?? '—'}
                    </td>
                    <td className="d-none d-lg-table-cell"><PriorityBadge priority={ticket.requestedPriority} /></td>
                    <td><PriorityBadge priority={ticket.itPriority} /></td>
                    <td>
                      <StatusBadge status={ticket.currentStatus} />
                      {ticket.requesterResolvedAt && <> <RequesterReportedBadge /></>}
                    </td>
                    <td className="d-none d-lg-table-cell">{ticket.ticketOwner?.name ?? 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-md-none d-flex flex-column gap-2">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="card"
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() => onOpenTicket(ticket.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpenTicket(ticket.id)
                  }
                }}
              >
                <div className="card-body">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <strong>{ticket.ticketNumber}</strong>
                    <div className="d-flex flex-wrap gap-1">
                      <StatusBadge status={ticket.currentStatus} />
                      {ticket.requesterResolvedAt && <RequesterReportedBadge />}
                    </div>
                  </div>
                  <p className="mb-1">{ticket.summary}</p>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <PriorityBadge priority={ticket.itPriority} />
                    <small className="text-body-secondary">{ticket.ticketOwner?.name ?? 'Unassigned'}</small>
                  </div>
                  <small className="text-body-secondary">{ticket.requester.name}</small>
                </div>
              </div>
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="Ticket queue pagination">
              <span className="text-body-secondary small">
                Page {meta.page} of {meta.totalPages} ({meta.totalItems} tickets)
              </span>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
