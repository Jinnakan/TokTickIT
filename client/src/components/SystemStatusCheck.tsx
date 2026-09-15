import { useState } from 'react'

type Category = {
  id: number
  name: string
}

export function SystemStatusCheck() {
  const [isLoading, setIsLoading] = useState(false)
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState('')

  async function checkSystem() {
    setIsLoading(true)
    setIsOnline(null)
    setCategories([])
    setError('')
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 8000)

    try {
      const [healthResponse, categoriesResponse] = await Promise.all([
        fetch('/api/health', { signal: controller.signal }),
        fetch('/api/categories', { signal: controller.signal }),
      ])

      if (!healthResponse.ok || !categoriesResponse.ok) {
        throw new Error('The TokTickIT API is unavailable.')
      }

      const health = await healthResponse.json() as { status: string }
      const loadedCategories = await categoriesResponse.json() as Category[]

      if (health.status !== 'ok') {
        throw new Error('The TokTickIT API reported an unhealthy status.')
      }

      setIsOnline(true)
      setCategories(loadedCategories)
    } catch {
      setIsOnline(false)
      setError('Unable to connect to TokTickIT API. Start the backend and check the database connection.')
    } finally {
      window.clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell d-flex align-items-center py-5">
      <section className="container" aria-labelledby="app-title">
        <div className="service-card mx-auto shadow-sm">
          <div className="service-card__header">
            <span className="brand-mark" aria-hidden="true">T</span>
            <div>
              <h1 id="app-title" className="h2 mb-1 fw-bold">TokTickIT</h1>
              <p className="mb-0 text-secondary">IT Service Desk</p>
            </div>
          </div>

          <hr className="my-4" />

          <p className="mb-4 text-body-secondary">
            Check the availability of the TokTickIT service before submitting a request.
          </p>

          <button
            type="button"
            className="btn btn-primary px-4 py-2 fw-semibold"
            onClick={checkSystem}
            disabled={isLoading}
          >
            {isLoading ? 'Checking…' : 'Check System'}
          </button>

          {isLoading && (
            <p className="status-message text-body-secondary mb-0 mt-4" role="status">
              <span aria-hidden="true">⌛</span> Loading system information…
            </p>
          )}

          {isOnline === true && (
            <div className="system-result mt-4">
              <p className="mb-4">
                <strong>System Status:</strong>{' '}
                <span className="badge text-bg-success">Online</span>
              </p>
              <h2 className="h5 mb-3">Supported Request Categories</h2>
              <ol className="mb-0 ps-4">
                {categories.map((category) => (
                  <li key={category.id}>{category.name}</li>
                ))}
              </ol>
            </div>
          )}

          {isOnline === false && (
            <div className="alert alert-danger mt-4 mb-0" role="alert">
              <strong>System Status: Offline</strong>
              <br />
              {error}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
