import { useState } from 'react'
import { AppShell } from './components/AppShell.js'
import { CreateTicketForm } from './components/CreateTicketForm.js'
import { DevRequesterSelection } from './components/DevRequesterSelection.js'
import { MyTicketsList } from './components/MyTicketsList.js'
import { DevRequesterProvider, useDevRequester } from './dev-requester-context.js'

export type AppView = 'my-tickets' | 'create-ticket'

function AppContent() {
  const { selectedRequester } = useDevRequester()
  const [activeView, setActiveView] = useState<AppView>('my-tickets')

  if (!selectedRequester) {
    return <DevRequesterSelection />
  }

  return (
    <AppShell activeView={activeView} onNavigate={setActiveView}>
      {activeView === 'my-tickets' ? (
        <MyTicketsList requesterId={selectedRequester.id} onCreateTicket={() => setActiveView('create-ticket')} />
      ) : (
        <CreateTicketForm requesterId={selectedRequester.id} onViewMyTickets={() => setActiveView('my-tickets')} />
      )}
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
