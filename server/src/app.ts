import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { prisma } from './prisma.js'
import { ticketsRouter } from './tickets.js'
import { attachmentsRouter, ticketAttachmentsRouter } from './attachments.js'
import { authRouter } from './auth/auth-router.js'
import { commentsRouter } from './comments.js'
import { notesRouter } from './notes.js'
import { staffTicketActionsRouter } from './staff/staff-ticket-actions.js'
import { usersRouter } from './users/users-router.js'
import { registerSessionInvalidationListener } from './users/session-invalidation-listener.js'

registerSessionInvalidationListener(prisma)

export const app = express()

// CSP + other security headers on every response (BR-L3-12, XSS
// defense-in-depth). This server only ever returns JSON/binary downloads,
// never HTML/inline scripts, so helmet's strict defaults have nothing to
// conflict with here.
app.use(helmet())
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'TokTickIT API',
  })
})

app.get('/api/categories', async (_request, response, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    response.status(200).json(categories)
  } catch (error) {
    next(error)
  }
})

app.get('/api/related-systems', async (_request, response, next) => {
  try {
    const relatedSystems = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    response.status(200).json(relatedSystems)
  } catch (error) {
    next(error)
  }
})

app.use('/api/auth', authRouter)
app.use('/api/tickets/:ticketId/attachments', ticketAttachmentsRouter)
app.use('/api/tickets/:ticketId/comments', commentsRouter)
app.use('/api/tickets/:ticketId/notes', notesRouter)
app.use('/api/tickets/:ticketId', staffTicketActionsRouter)
app.use('/api/attachments', attachmentsRouter)
app.use('/api/tickets', ticketsRouter)
app.use('/api/users', usersRouter)
