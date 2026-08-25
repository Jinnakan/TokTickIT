import type { NextFunction, Request, Response } from 'express'
import { prisma } from './prisma.js'

const HEADER_NAME = 'x-dev-requester-id'

export async function requireDevRequester(request: Request, response: Response, next: NextFunction) {
  const headerValue = request.header(HEADER_NAME)

  if (!headerValue || !/^\d+$/.test(headerValue)) {
    response.status(400).json({
      error: 'DEV_REQUESTER_REQUIRED',
      message: 'Select a Development Requester first.',
    })
    return
  }

  const requesterId = Number(headerValue)
  const requester = await prisma.devRequester.findUnique({ where: { id: requesterId } })

  if (!requester || !requester.isActive) {
    response.status(400).json({
      error: 'DEV_REQUESTER_INVALID',
      message: 'Selected Development Requester is no longer available.',
    })
    return
  }

  response.locals.devRequesterId = requesterId
  next()
}
