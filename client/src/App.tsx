import { useState } from 'react'
import { AppShell } from './components/AppShell.js'
import { CreateTicketForm } from './components/CreateTicketForm.js'
import { DevRequesterSelection } from './components/DevRequesterSelection.js'
import { MyTicketsList } from './components/MyTicketsList.js'
import { TicketDetail } from './components/TicketDetail.js'
import { DevRequesterProvider, useDevRequester } from './dev-requester-context.js'

export type AppView = 'my-tickets' | 'create-ticket'

function AppContent() {
  const { selectedRequester } = useDevRequester()
  const [activeView, setActiveView] = useState<AppView>('my-tickets')
  const [openTicketId, setOpenTicketId] = useState<number | null>(null)

  if (!selectedRequester) {
    return <DevRequesterSelection />
  }

  function navigate(view: AppView) {
    setOpenTicketId(null)
    setActiveView(view)
  }

  function renderContent() {
    if (openTicketId !== null) {
      return (
        <TicketDetail
          ticketId={openTicketId}
          requesterId={selectedRequester!.id}
          onBackToMyTickets={() => setOpenTicketId(null)}
        />
      )
    }

    if (activeView === 'my-tickets') {
      return (
        <MyTicketsList
          requesterId={selectedRequester!.id}
          onCreateTicket={() => navigate('create-ticket')}
          onOpenTicket={setOpenTicketId}
        />
      )
    }

    return (
      <CreateTicketForm
        requesterId={selectedRequester!.id}
        requesterName={selectedRequester!.name}
        onViewMyTickets={() => navigate('my-tickets')}
      />
    )
  }

  return (
    <AppShell activeView={activeView} onNavigate={navigate}>
      {renderContent()}
    </AppShell>
  )
}

export function App() {
  return (
    <DevRequesterProvider>
      <AppContent />
    </DevRequesterProvider>
  )
}
