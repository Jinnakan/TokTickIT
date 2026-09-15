import { App } from './App.js'
import { Login } from './components/Login.js'
import { ChangePassword } from './components/ChangePassword.js'

// Minimal path-based entry point for the new Lab 3 auth screens, reachable
// at /login and /change-password so they can be exercised directly (unit
// tests render them standalone; e2e/lab-03/authentication.spec.ts
// navigates to these paths). Every other path still renders the existing
// <App/> unchanged -- Issue 15 adds these screens without removing the
// Dev Requester selector or rewiring Requester screens onto real
// sessions, which is Issue 16/17's explicit scope.
export function Root() {
  const path = window.location.pathname

  if (path === '/login') {
    return (
      <Login
        onLoggedIn={(user) => {
          window.location.assign(user.mustChangePassword ? '/change-password' : '/')
        }}
      />
    )
  }

  if (path === '/change-password') {
    return (
      <ChangePassword
        mandatory
        onChanged={() => {
          window.location.assign('/')
        }}
      />
    )
  }

  return <App />
}
