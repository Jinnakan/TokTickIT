import type { ReactNode } from 'react'
import { useDevRequester } from '../dev-requester-context.js'
import type { AppView } from '../App.js'

export function AppShell({
  activeView,
  onNavigate,
  children,
}: {
  activeView: AppView
  onNavigate: (view: AppView) => void
  children: ReactNode
}) {
  const { selectedRequester, changeRequester } = useDevRequester()

  return (
    <div className="app-shell">
      <header className="navbar navbar-expand-md" style={{ backgroundColor: 'var(--zg-primary)' }}>
        <div className="container">
          <span className="navbar-brand text-white fw-bold d-flex align-items-center gap-2 mb-0">
            <span className="brand-mark" aria-hidden="true">T</span>
            TokTickIT
          </span>
          <nav className="d-flex align-items-center gap-3">
            <NavLink label="My Tickets" active={activeView === 'my-tickets'} onClick={() => onNavigate('my-tickets')} />
            <NavLink label="Create Ticket" active={activeView === 'create-ticket'} onClick={() => onNavigate('create-ticket')} />
          </nav>
          <div className="d-flex align-items-center gap-3">
            <span className="text-white">{selectedRequester?.name}</span>
            <button type="button" className="btn btn-outline-light btn-sm" onClick={changeRequester}>
              Change Requester
            </button>
          </div>
        </div>
      </header>
      <main className="container py-4">{children}</main>
    </div>
  )
}

/** Active nav item is visually distinct via underline + weight (ui-spec.md §5.1) rather than a
 * filled background — a dark secondary-green fill on the dark primary-green header would fail
 * contrast, so the distinction is white text/underline vs. muted text, not color alone. */
function NavLink({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-sm p-0 border-0 bg-transparent"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      style={{
        color: active ? '#fff' : 'rgba(255, 255, 255, 0.75)',
        fontWeight: active ? 600 : 400,
        textDecoration: active ? 'underline' : 'none',
        textUnderlineOffset: '4px',
      }}
    >
      {label}
    </button>
  )
}
