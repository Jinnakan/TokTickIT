import { AppShell } from './components/AppShell.js'
import { DevRequesterSelection } from './components/DevRequesterSelection.js'
import { DevRequesterProvider, useDevRequester } from './dev-requester-context.js'

function AppContent() {
  const { selectedRequester } = useDevRequester()

  if (!selectedRequester) {
    return <DevRequesterSelection />
  }

  return (
    <AppShell>
      <p className="text-body-secondary">
        Signed in as <strong>{selectedRequester.name}</strong>. Ticket screens are added in
        later Lab 2 issues.
      </p>
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
