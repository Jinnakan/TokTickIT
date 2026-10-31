import { useReducer, useRef } from 'react'
import { AppShell } from './components/shell/AppShell.js'
import { ChangePassword } from './components/auth/ChangePassword.js'
import { CreateTicketForm } from './components/tickets/CreateTicketForm.js'
import { Login } from './components/auth/Login.js'
import { MyTicketsList, type MyTicketsSnapshot } from './components/tickets/MyTicketsList.js'
import { StaffTicketQueue, type QueueSnapshot } from './components/tickets/StaffTicketQueue.js'
import { TicketDetail } from './components/tickets/TicketDetail.js'
import { UserManagement } from './components/admin/UserManagement.js'
import { CurrentUserProvider, useCurrentUser } from './current-user-context.js'
import { getNavItemsForRole } from './nav/role-navigation-factory.js'
import { RequesterDashboard } from './components/dashboard/RequesterDashboard.js'
import { StaffDashboard } from './components/dashboard/StaffDashboard.js'
import { StaffTicketDetail } from './components/tickets/StaffTicketDetail.js'
import { initialNavState, navReducer, type ListFilters } from './nav/app-navigation.js'

const BACK_LABELS: Record<string, string> = {
  dashboard: '← Back to Dashboard',
  'ticket-queue': '← Ticket Queue',
  'my-tickets': '← Back to My Tickets',
}

function AuthenticatedApp() {
  const { currentUser } = useCurrentUser()
  const [nav, dispatch] = useReducer(navReducer, undefined, () => initialNavState(currentUser!.role))
  // What the open list looked like, so Back restores filters, page and search after the list was unmounted.
  const snapshot = useRef<{ seq: number; value: unknown } | null>(null)

  if (!currentUser) return null // unreachable -- caller only renders this once currentUser exists

  const isRequester = currentUser.role === 'REQUESTER'
  const { place, placeSeq, openTicketId, listRefresh } = nav
  const goto = (key: string, filters?: ListFilters) => dispatch({ type: 'goto', key, filters })
  const openTicket = (ticketId: number) => dispatch({ type: 'open', ticketId })
  const savedFor = <T,>(): T | undefined => (snapshot.current?.seq === nav.placeSeq ? (snapshot.current.value as T) : undefined)
  const save = (value: unknown) => {
    snapshot.current = { seq: nav.placeSeq, value }
  }

  function renderPlace() {
    // A screen the role's navigation never offers (for example a direct call) is refused in words (ui-spec §3).
    if (!getNavItemsForRole(currentUser!.role).some((item) => item.key === place.key)) {
      return (
        <div className="alert alert-warning" role="alert">
          You do not have access to this page.
        </div>
      )
    }
    switch (place.key) {
      case 'ticket-queue':
        return (
          <StaffTicketQueue
            currentUserId={currentUser!.id}
            onOpenTicket={openTicket}
            initialFilters={place.filters}
            refreshKey={listRefresh}
            snapshot={savedFor<QueueSnapshot>()}
            onSnapshot={save}
          />
        )
      case 'user-management':
        return <UserManagement />
      case 'create-ticket':
        return <CreateTicketForm requesterName={currentUser!.name} onViewMyTickets={() => goto('my-tickets')} />
      case 'my-tickets':
        return (
          <MyTicketsList
            onCreateTicket={() => goto('create-ticket')}
            onOpenTicket={openTicket}
            initialFilters={place.filters}
            refreshKey={listRefresh}
            snapshot={savedFor<MyTicketsSnapshot>()}
            onSnapshot={save}
          />
        )
      default:
        return isRequester ? (
          <RequesterDashboard
            firstName={currentUser!.name.split(' ')[0]}
            onNavigate={goto}
            onOpenTicket={openTicket}
            refreshKey={listRefresh}
          />
        ) : (
          <StaffDashboard
            role={currentUser!.role as 'IT_STAFF' | 'ADMINISTRATOR'}
            firstName={currentUser!.name.split(' ')[0]}
            onNavigate={goto}
            onOpenTicket={openTicket}
            refreshKey={listRefresh}
          />
        )
    }
  }

  return (
    <AppShell activeKey={place.key} onNavigate={(key) => goto(key)}>
      {openTicketId === null && <div key={placeSeq}>{renderPlace()}</div>}
      {openTicketId !== null &&
        (isRequester ? (
          <TicketDetail
            ticketId={openTicketId}
            onBackToMyTickets={() => dispatch({ type: 'close' })}
            backLabel={BACK_LABELS[place.key]}
          />
        ) : (
          <StaffTicketDetail
            ticketId={openTicketId}
            currentUserId={currentUser.id}
            onBackToQueue={() => dispatch({ type: 'close' })}
            backLabel={BACK_LABELS[place.key]}
          />
        ))}
    </AppShell>
  )
}

function AppGate() {
  const { currentUser, status, refresh } = useCurrentUser()

  if (status === 'loading') {
    return (
      <main className="app-shell d-flex align-items-center justify-content-center py-5">
        <p className="status-message text-body-secondary" role="status">
          <span aria-hidden="true">⌛</span> Loading…
        </p>
      </main>
    )
  }

  if (!currentUser) {
    return <Login onLoggedIn={refresh} />
  }

  if (currentUser.mustChangePassword) {
    return <ChangePassword mandatory onChanged={refresh} />
  }

  return <AuthenticatedApp />
}

export function App() {
  return (
    <CurrentUserProvider>
      <AppGate />
    </CurrentUserProvider>
  )
}
