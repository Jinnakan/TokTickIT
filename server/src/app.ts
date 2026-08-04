import express from 'express'
import { categories } from './categories.js'

export const app = express()

app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.status(200).json({ status: 'ok', service: 'TokTickIT API' })
})

app.get('/api/categories', (_request, response) => {
  response.status(200).json(categories)
})
