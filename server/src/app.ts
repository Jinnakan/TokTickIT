import express from 'express'
import cookieParser from 'cookie-parser'
import { prisma } from './prisma.js'
import { ticketsRouter } from './tickets.js'
import { attachmentsRouter, ticketAttachmentsRouter } from './attachments.js'
import { authRouter } from './auth/auth-router.js'
import { commentsRouter } from './comments.js'

export const app = express()

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
app.use('/api/attachments', attachmentsRouter)
app.use('/api/tickets', ticketsRouter)
