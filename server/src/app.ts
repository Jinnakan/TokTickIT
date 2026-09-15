import express from 'express'
import { prisma } from './prisma.js'
import { ticketsRouter } from './tickets.js'
import { attachmentsRouter, ticketAttachmentsRouter } from './attachments.js'

export const app = express()

app.use(express.json())

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

app.get('/api/dev-requesters', async (_request, response, next) => {
  try {
    const requesters = await prisma.devRequester.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { id: 'asc' },
    })

    response.status(200).json(requesters)
  } catch (error) {
    next(error)
  }
})

app.use('/api/tickets/:ticketId/attachments', ticketAttachmentsRouter)
app.use('/api/attachments', attachmentsRouter)
app.use('/api/tickets', ticketsRouter)
