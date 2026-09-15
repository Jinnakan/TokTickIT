import { vi } from 'vitest'

type AppFetchOverrides = {
  currentUser?: unknown
  categories?: unknown
  relatedSystems?: unknown
  ticketsList?: unknown
}

const EMPTY_TICKET_LIST = { data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } }

/**
 * URL-routed fetch stub covering every endpoint the app shell can call
 * (current-user session check, categories, related-systems, tickets list).
 * Any endpoint without an override returns a safe empty/unauthenticated
 * result rather than throwing, so tests that only care about one screen
 * don't need to know about every other screen's calls. `currentUser`
 * defaults to `null` (401 from /api/auth/me), matching an unauthenticated
 * visitor -- pass a user object to simulate an already-logged-in session.
 */
export function stubAppFetch(overrides: AppFetchOverrides = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/auth/me') {
      if (overrides.currentUser) {
        return { ok: true, status: 200, json: async () => overrides.currentUser } as Response
      }
      return { ok: false, status: 401, json: async () => ({ error: 'UNAUTHENTICATED' }) } as Response
    }
    if (url === '/api/categories') {
      return { ok: true, json: async () => overrides.categories ?? [] } as Response
    }
    if (url === '/api/related-systems') {
      return { ok: true, json: async () => overrides.relatedSystems ?? [] } as Response
    }
    if (url.startsWith('/api/tickets')) {
      return { ok: true, json: async () => overrides.ticketsList ?? EMPTY_TICKET_LIST } as Response
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }))
}
