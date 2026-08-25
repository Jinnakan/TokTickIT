import express from 'express'
import { prisma } from './prisma.js'

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
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    response.status(200).json(categories)
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
