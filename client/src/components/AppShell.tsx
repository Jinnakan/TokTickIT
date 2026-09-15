import type { ReactNode } from 'react'
import { useCurrentUser } from '../current-user-context.js'
import { getNavItemsForRole } from '../nav/role-navigation-factory.js'

export function AppShell({
  activeKey,
  onNavigate,
  children,
}: {
  activeKey: string
  onNavigate: (key: string) => void
  children: ReactNode
}) {
  const { currentUser, logout } = useCurrentUser()
  const navItems = currentUser ? getNavItemsForRole(currentUser.role) : []

  return (
    <div className="app-shell">
      <header className="navbar navbar-expand-md" style={{ backgroundColor: 'var(--zg-primary)' }}>
        <div className="container">
          <span className="navbar-brand text-white fw-bold d-flex align-items-center gap-2 mb-0">
            <span className="brand-mark" aria-hidden="true">T</span>
            TokTickIT
          </span>
          <nav className="d-flex align-items-center gap-3">
            {navItems.map((item) => (
              <NavLink
                key={item.key}
                label={item.label}
                active={activeKey === item.key}
                onClick={() => onNavigate(item.key)}
              />
            ))}
          </nav>
          <div className="d-flex align-items-center gap-3">
            <span className="text-white">
              {currentUser?.name}
              {currentUser && <span className="text-white-50"> ({roleLabel(currentUser.role)})</span>}
            </span>
            <button type="button" className="btn btn-outline-light btn-sm" onClick={() => void logout()}>
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="container py-4">{children}</main>
    </div>
  )
}

function roleLabel(role: string): string {
  if (role === 'IT_STAFF') return 'IT Staff'
  if (role === 'ADMINISTRATOR') return 'Administrator'
  return 'Requester'
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
