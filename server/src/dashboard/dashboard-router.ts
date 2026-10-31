import { Router } from 'express'
import { prisma } from '../prisma.js'
import { requireSession, requirePasswordAlreadyChanged } from '../auth/require-session.js'
import { requireRole } from '../authorization/require-role.js'
import { createDashboardService } from './dashboard-service.js'

export const dashboardRouter = Router()

const service = createDashboardService(prisma)
const requireRequester = [requireSession, requirePasswordAlreadyChanged, requireRole('REQUESTER')]
const requireStaff = [requireSession, requirePasswordAlreadyChanged, requireRole('IT_STAFF', 'ADMINISTRATOR')]

// Scoped by the session user id only; nothing in the request selects whose numbers are shown.
dashboardRouter.get('/requester', ...requireRequester, async (_request, response, next) => {
  try {
    response.status(200).json(await service.requester(response.locals.userId as number))
  } catch (error) {
    next(error)
  }
})

dashboardRouter.get('/staff', ...requireStaff, async (_request, response, next) => {
  try {
    const role = response.locals.userRole as 'IT_STAFF' | 'ADMINISTRATOR'
    response.status(200).json(await service.staff(response.locals.userId as number, role))
  } catch (error) {
    next(error)
  }
})
