import { AppShell } from './components/AppShell.js'
import { CreateTicketForm } from './components/CreateTicketForm.js'
import { DevRequesterSelection } from './components/DevRequesterSelection.js'
import { DevRequesterProvider, useDevRequester } from './dev-requester-context.js'

function AppContent() {
  const { selectedRequester } = useDevRequester()

  if (!selectedRequester) {
    return <DevRequesterSelection />
  }

  return (
    <AppShell>
      <CreateTicketForm requesterId={selectedRequester.id} />
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
