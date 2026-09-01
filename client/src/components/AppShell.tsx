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
      <header className="navbar navbar-expand-md" style={{ backgroundColor: '#006B3C' }}>
        <div className="container">
          <span className="navbar-brand text-white fw-bold d-flex align-items-center gap-2 mb-0">
            <span className="brand-mark" aria-hidden="true">T</span>
            TokTickIT
          </span>
          <nav className="d-flex align-items-center gap-2">
            <button
              type="button"
              className={`btn btn-sm ${activeView === 'my-tickets' ? 'btn-light' : 'btn-outline-light'}`}
              aria-current={activeView === 'my-tickets' ? 'page' : undefined}
              onClick={() => onNavigate('my-tickets')}
            >
              My Tickets
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeView === 'create-ticket' ? 'btn-light' : 'btn-outline-light'}`}
              aria-current={activeView === 'create-ticket' ? 'page' : undefined}
              onClick={() => onNavigate('create-ticket')}
            >
              Create Ticket
            </button>
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
