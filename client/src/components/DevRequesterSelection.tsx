import { useState, type FormEvent } from 'react'
import { useDevRequester } from '../dev-requester-context.js'

export function DevRequesterSelection() {
  const { requesters, status, selectRequester, retry } = useDevRequester()
  const [pendingId, setPendingId] = useState<number | ''>('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pendingId === '') return
    selectRequester(pendingId)
  }

  return (
    <main className="app-shell d-flex align-items-center py-5">
      <section className="container" aria-labelledby="selection-title">
        <div className="service-card mx-auto shadow-sm">
          <div className="service-card__header">
            <span className="brand-mark" aria-hidden="true">T</span>
            <div>
              <h1 id="selection-title" className="h2 mb-1 fw-bold">TokTickIT</h1>
              <p className="mb-0 text-secondary">Select Development Requester</p>
            </div>
          </div>

          <hr className="my-4" />

          <p className="mb-4 text-body-secondary">
            Select a Development Requester to test requester-specific ticket behavior. This is
            not a login screen. Authentication and role-based access will be introduced in Lab 3.
          </p>

          {status === 'loading' && (
            <p className="status-message text-body-secondary mb-0" role="status">
              <span aria-hidden="true">⌛</span> Loading development requesters…
            </p>
          )}

          {status === 'error' && (
            <div className="alert alert-danger mb-0" role="alert">
              <strong>Unable to load development requesters.</strong>
              <br />
              Start the backend and check the database connection.
              <div className="mt-3">
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={retry}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {status === 'ready' && requesters.length === 0 && (
            <div className="alert alert-warning mb-0" role="alert">
              No active development requesters are available. Seed the database before continuing.
            </div>
          )}

          {status === 'ready' && requesters.length > 0 && (
            <form onSubmit={handleSubmit}>
              <label htmlFor="dev-requester-select" className="form-label fw-semibold">
                Development Requester <span className="text-danger">*</span>
              </label>
              <select
                id="dev-requester-select"
                className="form-select mb-3"
                value={pendingId}
                onChange={(event) => setPendingId(event.target.value === '' ? '' : Number(event.target.value))}
                required
              >
                <option value="" disabled>
                  Select a development requester…
                </option>
                {requesters.map((requester) => (
                  <option key={requester.id} value={requester.id}>
                    {requester.name}
                  </option>
                ))}
              </select>

              <p className="small text-body-secondary mb-4">
                Only active development requesters are shown.
              </p>

              <div className="p-3 mb-4 rounded" style={{ backgroundColor: '#EAF6EF' }}>
                <strong>Authentication coming in Lab 3.</strong>
                <br />
                In Lab 3, this selection will be replaced with secure authentication so you can
                access the system with your own account.
              </div>

              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary px-4 py-2 fw-semibold" disabled={pendingId === ''}>
                  Continue
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
