import { useEffect, useState } from 'react'
import { fetchActiveCategories, type ReferenceItem } from '../api/referenceData.js'
import { fetchTickets } from '../api/tickets.js'
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TICKET_STATUSES,
  STATUS_LABELS,
} from '@toktickit/shared'
import type { Priority, SortDirection, TicketListItem, TicketListMeta, TicketSortField, TicketStatus } from '../types/ticket.js'
import { PriorityBadge, StatusBadge } from './TicketBadges.js'

type ListStatus = 'loading' | 'ready' | 'error'

const COLUMNS: { field: TicketSortField; label: string }[] = [
  { field: 'ticketNumber', label: 'Ticket No.' },
  { field: 'createdAt', label: 'Created Date' },
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

export function MyTicketsList({
  requesterId,
  onCreateTicket,
  onOpenTicket,
}: {
  requesterId: number
  onCreateTicket: () => void
  onOpenTicket: (ticketId: number) => void
}) {
  const [categories, setCategories] = useState<ReferenceItem[]>([])

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [requestedPriority, setRequestedPriority] = useState<Priority | ''>('')
  const [currentStatus, setCurrentStatus] = useState<TicketStatus | ''>('')
  const [sortBy, setSortBy] = useState<TicketSortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)

  const [status, setStatus] = useState<ListStatus>('loading')
  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [meta, setMeta] = useState<TicketListMeta | null>(null)

  const hasActiveFilters = search !== '' || categoryId !== '' || requestedPriority !== '' || currentStatus !== ''

  useEffect(() => {
    fetchActiveCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let ignore = false
    setStatus('loading')

    fetchTickets(
      {
        search: search || undefined,
        categoryId: categoryId === '' ? undefined : Number(categoryId),
        requestedPriority: requestedPriority || undefined,
        currentStatus: currentStatus || undefined,
        sortBy,
        sortDir,
        page,
      },
      requesterId,
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
  }, [search, categoryId, requestedPriority, currentStatus, sortBy, sortDir, page, requesterId])

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    setPage(1)
  }

  function handlePriorityChange(value: Priority | '') {
    setRequestedPriority(value)
    setPage(1)
  }

  function handleStatusChange(value: TicketStatus | '') {
    setCurrentStatus(value)
    setPage(1)
  }

  function handleClearFilters() {
    setSearch('')
    setCategoryId('')
    setRequestedPriority('')
    setCurrentStatus('')
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
          <h1 className="h4 fw-bold mb-1">My Tickets</h1>
          <p className="text-body-secondary mb-0">View and track all of your support requests.</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClearFilters}>
            Clear Filters
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onCreateTicket}>
            Create Ticket
          </button>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <input
            type="search"
            className="form-control"
            placeholder="Search by ticket number or summary…"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            aria-label="Search tickets"
          />
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={categoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <select
            className="form-select"
            value={requestedPriority}
            onChange={(event) => handlePriorityChange(event.target.value as Priority | '')}
            aria-label="Filter by requested priority"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={currentStatus}
            onChange={(event) => handleStatusChange(event.target.value as TicketStatus | '')}
            aria-label="Filter by current status"
          >
            <option value="">All Statuses</option>
            {TICKET_STATUSES.map((statusValue) => (
              <option key={statusValue} value={statusValue}>
                {STATUS_LABELS[statusValue]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status === 'loading' && (
        <p className="status-message text-body-secondary" role="status">
          <span aria-hidden="true">⌛</span> Loading tickets…
        </p>
      )}

      {status === 'error' && (
        <div className="alert alert-danger" role="alert">
          <strong>Unable to load tickets.</strong>
          <br />
          Start the backend and check the database connection.
        </div>
      )}

      {status === 'ready' && tickets.length === 0 && !hasActiveFilters && (
        <div className="alert alert-secondary" role="status">
          You haven&apos;t created any tickets yet.{' '}
          <button type="button" className="btn btn-link p-0 align-baseline" onClick={onCreateTicket}>
            Create your first ticket
          </button>
          .
        </div>
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
                  <th>Category</th>
                  <th>Requested Priority</th>
                  <th>Current Status</th>
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
                    <td>{formatDate(ticket.createdAt)}</td>
                    <td>{ticket.summary}</td>
                    <td>{categories.find((category) => category.id === ticket.categoryId)?.name ?? '—'}</td>
                    <td><PriorityBadge priority={ticket.requestedPriority} /></td>
                    <td><StatusBadge status={ticket.currentStatus} /></td>
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
                  <div className="d-flex justify-content-between">
                    <strong>{ticket.ticketNumber}</strong>
                    <StatusBadge status={ticket.currentStatus} />
                  </div>
                  <p className="mb-1">{ticket.summary}</p>
                  <div className="d-flex justify-content-between align-items-center">
                    <PriorityBadge priority={ticket.requestedPriority} />
                    <small className="text-body-secondary">{formatDate(ticket.createdAt)}</small>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="Ticket list pagination">
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
