import { useState, type FormEvent } from 'react'
import { login, LoginError, type CurrentUser } from '../api/auth.js'

export function Login({ onLoggedIn }: { onLoggedIn: (user: CurrentUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const user = await login(email, password)
      onLoggedIn(user)
    } catch (error) {
      // Same generic message for wrong password, unknown email, or an
      // inactive account (BR-L3-05) -- never reveals which case it was.
      if (error instanceof LoginError) {
        setErrorMessage(error.message)
        if (error.kind !== 'too-many-attempts') {
          setPassword('')
        }
      } else {
        setErrorMessage('Unable to log in right now.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-shell d-flex align-items-center py-5">
      <section className="container" aria-labelledby="login-title">
        <div className="service-card mx-auto shadow-sm">
          <div className="service-card__header">
            <span className="brand-mark" aria-hidden="true">T</span>
            <div>
              <h1 id="login-title" className="h2 mb-1 fw-bold">TokTickIT</h1>
              <p className="mb-0 text-secondary">Sign in</p>
            </div>
          </div>

          <hr className="my-4" />

          <form onSubmit={handleSubmit}>
            <fieldset disabled={isSubmitting} className="border-0 p-0 m-0">
              <label htmlFor="login-email" className="form-label fw-semibold">
                Email <span className="text-danger">*</span>
              </label>
              <input
                id="login-email"
                type="email"
                className="form-control mb-3"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />

              <label htmlFor="login-password" className="form-label fw-semibold">
                Password <span className="text-danger">*</span>
              </label>
              <div className="input-group mb-3">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              {errorMessage && (
                <div className="alert alert-danger" role="alert">
                  {errorMessage}
                </div>
              )}

              <button type="submit" className="btn btn-primary px-4 py-2 fw-semibold" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Login'}
              </button>
            </fieldset>
          </form>
        </div>
      </section>
    </main>
  )
}
