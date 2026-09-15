import { vi } from 'vitest'

type AppFetchOverrides = {
  devRequesters?: unknown
  categories?: unknown
  relatedSystems?: unknown
  ticketsList?: unknown
}

const EMPTY_TICKET_LIST = { data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } }

/**
 * URL-routed fetch stub covering every endpoint the app shell can call
 * (dev-requesters, categories, related-systems, tickets list). Any endpoint
 * without an override returns a safe empty result rather than throwing, so
 * tests that only care about one screen don't need to know about every
 * other screen's calls.
 */
export function stubAppFetch(overrides: AppFetchOverrides = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/dev-requesters') {
      return { ok: true, json: async () => overrides.devRequesters ?? [] } as Response
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
