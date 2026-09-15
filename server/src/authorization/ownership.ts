import type { Response } from 'express'

/**
 * Shared across every resource type that needs an owner/role check
 * (Ticket/Attachment in Lab 2, extended to Users/Sessions in Lab 3 and to
 * Comments/Notes as those land) -- one place decides "not found" vs
 * "belongs to someone else" (404 vs 403), so a route handler can't
 * accidentally leak ownership by rolling its own check.
 */
export type OwnershipResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'not_found' }
  | { status: 'forbidden' }

/** Writes the 404/403 response for a non-'ok' OwnershipResult. Never call this with 'ok'. */
export function respondOwnershipFailure(
  response: Response,
  result: { status: 'not_found' } | { status: 'forbidden' },
  errorCodes: { notFound: string; forbidden: string },
): void {
  if (result.status === 'not_found') {
    response.status(404).json({ error: errorCodes.notFound })
    return
  }
  response.status(403).json({ error: errorCodes.forbidden })
}
