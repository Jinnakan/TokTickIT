import { guardFor } from '../http/guards.js'
import { parseId } from '../http/params.js'
import { Router } from 'express'
import { checkTicketAccess } from '../authorization/ticket-access.js'
import { resolveOwnedTicket, respondOwnershipFailure } from '../authorization/ticket-ownership.js'
import {
  changePriority,
  changeStatus,
  claim,
  listHistory,
  markAppearsResolved,
  reassign,
} from './ticket-workflow-service.js'

export const ticketWorkflowRouter = Router({ mergeParams: true })

const requireStaff = guardFor('IT_STAFF', 'ADMINISTRATOR')
const requireRequester = guardFor('REQUESTER')
const requireAnyRole = guardFor('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR')

ticketWorkflowRouter.post('/claim', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = parseId(request.params.ticketId)
    if (ticketId === null) return void response.status(404).json({ error: 'TICKET_NOT_FOUND' })
    const result = await claim(ticketId, response.locals.userId as number)
    response.status(result.httpStatus).json(result.body)
  } catch (error) {
    next(error)
  }
})

ticketWorkflowRouter.post('/reassign', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = parseId(request.params.ticketId)
    if (ticketId === null) return void response.status(404).json({ error: 'TICKET_NOT_FOUND' })
    const result = await reassign(ticketId, request.body?.ticketOwnerId, request.body?.expectedVersion)
    response.status(result.httpStatus).json(result.body)
  } catch (error) {
    next(error)
  }
})

ticketWorkflowRouter.patch('/priority', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = parseId(request.params.ticketId)
    if (ticketId === null) return void response.status(404).json({ error: 'TICKET_NOT_FOUND' })
    const result = await changePriority(ticketId, request.body?.itPriority, request.body?.expectedVersion)
    response.status(result.httpStatus).json(result.body)
  } catch (error) {
    next(error)
  }
})

ticketWorkflowRouter.patch('/status', ...requireStaff, async (request, response, next) => {
  try {
    const ticketId = parseId(request.params.ticketId)
    if (ticketId === null) return void response.status(404).json({ error: 'TICKET_NOT_FOUND' })
    const result = await changeStatus(
      ticketId,
      response.locals.userId as number,
      request.body?.status,
      request.body?.expectedVersion,
    )
    response.status(result.httpStatus).json(result.body)
  } catch (error) {
    next(error)
  }
})

// Requester only, own Ticket only (BR-L4-12). Role is checked before ownership.
ticketWorkflowRouter.post('/appears-resolved', ...requireRequester, async (request, response, next) => {
  try {
    const ticketId = parseId(request.params.ticketId)
    if (ticketId === null) return void response.status(404).json({ error: 'TICKET_NOT_FOUND' })

    const ownership = await resolveOwnedTicket(ticketId, response.locals.userId as number)
    if (ownership.status !== 'ok') {
      respondOwnershipFailure(response, ownership, { notFound: 'TICKET_NOT_FOUND', forbidden: 'TICKET_FORBIDDEN' })
      return
    }
    const result = await markAppearsResolved(ticketId)
    response.status(result.httpStatus).json(result.body)
  } catch (error) {
    next(error)
  }
})

ticketWorkflowRouter.get('/history', ...requireAnyRole, async (request, response, next) => {
  try {
    const ticketId = parseId(request.params.ticketId)
    if (ticketId === null) return void response.status(404).json({ error: 'TICKET_NOT_FOUND' })
    if (!(await checkTicketAccess(ticketId, response.locals.userId as number, response.locals.userRole as string, response))) return

    const result = await listHistory(ticketId)
    response.status(result.httpStatus).json(result.body)
  } catch (error) {
    next(error)
  }
})

// History is append-only: no write route exists (BR-L4-16).
ticketWorkflowRouter.all('/history', ...requireAnyRole, (_request, response) => {
  response.status(404).json({ error: 'NOT_FOUND' })
})
