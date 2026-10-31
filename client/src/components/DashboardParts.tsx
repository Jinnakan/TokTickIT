import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Card, DrillDown } from '../api/dashboard.js'
import type { ListFilters } from '../nav/app-navigation.js'

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export type Navigate = (key: string, filters?: ListFilters) => void

/** A drill-down target as the navigation call it stands for. */
export function followDrillDown(drillDown: DrillDown, onNavigate: Navigate) {
  if (drillDown) onNavigate(drillDown.view, drillDown.query as ListFilters)
}

/**
 * Loads a dashboard and handles the feedback states of ui-spec §3: loading,
 * safe failure with Retry, and Refresh that disables while loading and
 * announces the result politely. The layout keeps its place while refreshing.
 */
export function useDashboard<T>(load: (signal: AbortSignal) => Promise<T>, refreshKey: number) {
  const [data, setData] = useState<T | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [announcement, setAnnouncement] = useState('')
  const [token, setToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState((current) => (current === 'ready' ? 'ready' : 'loading'))
    load(controller.signal)
      .then((loaded) => {
        setData(loaded)
        setState('ready')
        setAnnouncement(token > 0 ? 'Dashboard updated' : '')
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error')
      })
    return () => controller.abort()
  }, [load, refreshKey, token])

  const reload = useCallback(() => {
    setState('loading')
    setToken((value) => value + 1)
  }, [])

  return { data, state, announcement, reload }
}

export function DashboardShell({
  title,
  state,
  hasData,
  announcement,
  onReload,
  children,
}: {
  title: string
  state: 'loading' | 'ready' | 'error'
  /** Once there is data, a refresh keeps it on screen so the layout does not jump. */
  hasData: boolean
  announcement: string
  onReload: () => void
  children: ReactNode
}) {
  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h4 fw-bold mb-0">{title}</h1>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={state === 'loading'} onClick={onReload}>
          Refresh
        </button>
      </div>
      <p className="visually-hidden" role="status">{announcement}</p>

      {state === 'loading' && !hasData && (
        <p className="status-message text-body-secondary" role="status">
          <span aria-hidden="true">⌛</span> Loading dashboard…
        </p>
      )}
      {state === 'error' && (
        <div className="alert alert-danger d-flex flex-wrap align-items-center gap-2" role="alert">
          <span>Unable to load the dashboard.</span>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={onReload}>Retry</button>
        </div>
      )}
      {children}
    </div>
  )
}

/** One link holding label, large count and "View all"; the whole card is the click target (ui-spec §2). */
export function MetricCard({ card, onNavigate }: { card: Card; onNavigate: Navigate }) {
  const body = (
    <>
      <div className="small text-body-secondary">{card.label}</div>
      <div className="display-6 fw-bold">{card.count}</div>
    </>
  )

  if (!card.drillDown) {
    return (
      <div className="card h-100 shadow-sm">
        <div className="card-body">
          {body}
          <div className="small text-body-secondary">See the list below</div>
        </div>
      </div>
    )
  }

  return (
    <a
      href={`#${card.key}`}
      className="card h-100 shadow-sm text-decoration-none text-reset"
      aria-label={`${card.label}, ${card.count} ${card.count === 1 ? 'ticket' : 'tickets'}`}
      onClick={(event) => {
        event.preventDefault()
        followDrillDown(card.drillDown, onNavigate)
      }}
    >
      <div className="card-body">
        {body}
        <div className="small fw-semibold" style={{ color: 'var(--zg-secondary)' }}>View all</div>
      </div>
    </a>
  )
}

export function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section className="mb-4" aria-labelledby={id}>
      <h2 id={id} className="h6 fw-bold mb-2">{title}</h2>
      {children}
    </section>
  )
}
