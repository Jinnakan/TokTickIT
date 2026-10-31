import { Router } from 'express'
import { requireSession, requirePasswordAlreadyChanged } from '../auth/require-session.js'
import { requireRole } from '../authorization/require-role.js'
import { checkTicketAccess } from '../authorization/ticket-access.js'
import { createAction, listActions, updateAction } from './action-service.js'

export const actionsRouter = Router({ mergeParams: true })

const requireAnyRole = [requireSession, requirePasswordAlreadyChanged, requireRole('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR')]
const requireStaff = [requireSession, requirePasswordAlreadyChanged, requireRole('IT_STAFF', 'ADMINISTRATOR')]

function toInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

actionsRouter.get('/', ...requireAnyRole, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }
    const userId = response.locals.userId as number
    const role = response.locals.userRole as string
    if (!(await checkTicketAccess(ticketId, userId, role, response))) return

    response.status(200).json(await listActions(ticketId))
  } catch (error) {
    next(error)
  }
})

actionsRouter.post('/', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }
    const result = await createAction(ticketId, response.locals.userId as number, request.body)
    response.status(result.httpStatus).json(result.body)
  } catch (error) {
    next(error)
  }
})

actionsRouter.patch('/:actionId', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = toInteger(request.params.ticketId)
    const actionId = toInteger(request.params.actionId)
    if (ticketId === null) {
      response.status(404).json({ error: 'TICKET_NOT_FOUND' })
      return
    }
    if (actionId === null) {
      response.status(404).json({ error: 'ACTION_NOT_FOUND' })
      return
    }
    const result = await updateAction(ticketId, actionId, request.body)
    response.status(result.httpStatus).json(result.body)
  } catch (error) {
    next(error)
  }
})

// Actions are cancelled, never deleted (BR-L4-08). Session is still required, so an anonymous caller gets 401.
actionsRouter.delete('/:actionId', ...requireAnyRole, (_request, response) => {
  response.status(404).json({ error: 'ACTION_NOT_FOUND' })
})
