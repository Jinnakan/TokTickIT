import type { ReactNode } from 'react'
import { useDevRequester } from '../dev-requester-context.js'

export function AppShell({ children }: { children: ReactNode }) {
  const { selectedRequester, changeRequester } = useDevRequester()

  return (
    <div className="app-shell">
      <header className="navbar navbar-expand-md" style={{ backgroundColor: '#006B3C' }}>
        <div className="container">
          <span className="navbar-brand text-white fw-bold d-flex align-items-center gap-2 mb-0">
            <span className="brand-mark" aria-hidden="true">T</span>
            TokTickIT
          </span>
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
