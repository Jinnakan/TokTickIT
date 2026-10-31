import type { ErrorRequestHandler, RequestHandler } from 'express'

/** An API-only server: an unknown path is a JSON 404, never an HTML page. */
export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: 'NOT_FOUND' })
}

type ParserError = { type?: string; status?: number }

/**
 * Last handler in the chain. Client mistakes keep their own stable code;
 * everything else is a 500 whose cause stays in the server log, never in the
 * response (api-spec §0).
 */
export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (response.headersSent) {
    next(error)
    return
  }

  const parserError = (error ?? {}) as ParserError
  if (parserError.type === 'entity.parse.failed') {
    response.status(400).json({ error: 'INVALID_JSON' })
    return
  }
  if (parserError.type === 'entity.too.large') {
    response.status(413).json({ error: 'PAYLOAD_TOO_LARGE' })
    return
  }

  // Any other client-side parser failure (bad charset, aborted request) is a 400, not a server fault.
  if (typeof parserError.status === 'number' && parserError.status >= 400 && parserError.status < 500) {
    response.status(parserError.status).json({ error: 'BAD_REQUEST' })
    return
  }

  console.error(`${request.method} ${request.originalUrl} failed:`, error)
  response.status(500).json({ error: 'INTERNAL_ERROR' })
}
