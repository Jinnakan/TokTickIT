import { useState } from 'react'
import { AppShell } from './components/AppShell.js'
import { ChangePassword } from './components/ChangePassword.js'
import { CreateTicketForm } from './components/CreateTicketForm.js'
import { Login } from './components/Login.js'
import { MyTicketsList } from './components/MyTicketsList.js'
import { StaffTicketQueue } from './components/StaffTicketQueue.js'
import { TicketDetail } from './components/TicketDetail.js'
import { UserManagement } from './components/UserManagement.js'
import { CurrentUserProvider, useCurrentUser } from './current-user-context.js'
import { getNavItemsForRole } from './nav/role-navigation-factory.js'

function AuthenticatedApp() {
  const { currentUser } = useCurrentUser()
  const [activeKey, setActiveKey] = useState(() => getNavItemsForRole(currentUser!.role)[0]?.key ?? '')
  const [openTicketId, setOpenTicketId] = useState<number | null>(null)

  if (!currentUser) return null // unreachable -- caller only renders this once currentUser exists

  function navigate(key: string) {
    setOpenTicketId(null)
    setActiveKey(key)
  }

  function renderContent() {
    if (currentUser!.role === 'IT_STAFF') {
      return <StaffTicketQueue currentUserId={currentUser!.id} />
    }

    if (currentUser!.role === 'ADMINISTRATOR') {
      return <UserManagement />
    }

    if (openTicketId !== null) {
      return <TicketDetail ticketId={openTicketId} onBackToMyTickets={() => setOpenTicketId(null)} />
    }

    if (activeKey === 'create-ticket') {
      return <CreateTicketForm requesterName={currentUser!.name} onViewMyTickets={() => navigate('my-tickets')} />
    }

    return <MyTicketsList onCreateTicket={() => navigate('create-ticket')} onOpenTicket={setOpenTicketId} />
  }

  return (
    <AppShell activeKey={activeKey} onNavigate={navigate}>
      {renderContent()}
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
