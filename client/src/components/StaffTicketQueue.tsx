import { useEffect, useState } from 'react'
import { fetchActiveCategories, type ReferenceItem } from '../api/referenceData.js'
import { fetchStaffTicketQueue } from '../api/staffTickets.js'
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
} from '../types/ticket.js'
import { PriorityBadge, StatusBadge } from './TicketBadges.js'
import { StaffTicketDetail } from './StaffTicketDetail.js'

type ListStatus = 'loading' | 'ready' | 'error'

const COLUMNS: { field: TicketSortField; label: string }[] = [
  { field: 'ticketNumber', label: 'Ticket No.' },
  { field: 'createdAt', label: 'Last Updated' },
  { field: 'summary', label: 'Summary' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function StaffTicketQueue({ currentUserId }: { currentUserId: number }) {
  const [categories, setCategories] = useState<ReferenceItem[]>([])

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [requestedPriority, setRequestedPriority] = useState<Priority | ''>('')
  const [itPriority, setItPriority] = useState<Priority | ''>('')
  const [currentStatus, setCurrentStatus] = useState<TicketStatus | ''>('')
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<TicketSortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)

  const [status, setStatus] = useState<ListStatus>('loading')
  const [tickets, setTickets] = useState<StaffTicketListItem[]>([])
  const [meta, setMeta] = useState<TicketListMeta | null>(null)
  const [openTicket, setOpenTicket] = useState<StaffTicketListItem | null>(null)

  const hasActiveFilters =
    search !== '' || categoryId !== '' || requestedPriority !== '' || itPriority !== '' || currentStatus !== '' || unassignedOnly

  useEffect(() => {
    fetchActiveCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let ignore = false
    setStatus('loading')

    fetchStaffTicketQueue(
      {
        search: search || undefined,
        categoryId: categoryId === '' ? undefined : Number(categoryId),
        requestedPriority: requestedPriority || undefined,
        itPriority: itPriority || undefined,
        currentStatus: currentStatus || undefined,
        unassignedOnly: unassignedOnly || undefined,
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
  }, [search, categoryId, requestedPriority, itPriority, currentStatus, unassignedOnly, sortBy, sortDir, page])

  function handleClearFilters() {
    setSearch('')
    setCategoryId('')
    setRequestedPriority('')
    setItPriority('')
    setCurrentStatus('')
    setUnassignedOnly(false)
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

  if (openTicket) {
    return (
      <StaffTicketDetail
        ticketId={openTicket.id}
        currentUserId={currentUserId}
        onBackToQueue={() => setOpenTicket(null)}
      />
    )
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h1 className="h4 fw-bold mb-1">Ticket Queue</h1>
          <p className="text-body-secondary mb-0">Tickets from every Requester.</p>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClearFilters}>
          Clear Filters
        </button>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-3">
          <input
            type="search"
            className="form-control"
            placeholder="Search by ticket number or summary…"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            aria-label="Search tickets"
          />
        </div>
        <div className="col-md-2">
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
        <div className="col-md-2">
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
        <div className="col-md-2">
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
        <div className="col-md-3">
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
                    onClick={() => setOpenTicket(ticket)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setOpenTicket(ticket)
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
                    <td><StatusBadge status={ticket.currentStatus} /></td>
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
                onClick={() => setOpenTicket(ticket)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setOpenTicket(ticket)
                  }
                }}
              >
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <strong>{ticket.ticketNumber}</strong>
                    <StatusBadge status={ticket.currentStatus} />
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
