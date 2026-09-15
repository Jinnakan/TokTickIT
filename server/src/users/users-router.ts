import { Router } from 'express'
import type { Role } from '@prisma/client'
import { prisma } from '../prisma.js'
import { requireSession, requirePasswordAlreadyChanged } from '../auth/require-session.js'
import { requireRole } from '../authorization/require-role.js'
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ROLES,
  type FieldErrors,
} from '@toktickit/shared'
import { UserService } from './user-service.js'

export const usersRouter = Router()

const requireAdmin = [requireSession, requirePasswordAlreadyChanged, requireRole('ADMINISTRATOR')]
const userService = new UserService(prisma)

function toInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function toUserResponse(user: {
  id: number
  email: string
  name: string
  role: Role
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Date
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  }
}

/** True if deactivating/reassigning this user would leave zero active Administrators. */
async function wouldRemoveLastActiveAdmin(userId: number, nextIsActive: boolean, nextRole?: Role): Promise<boolean> {
  const current = await prisma.user.findUnique({ where: { id: userId } })
  if (!current || current.role !== 'ADMINISTRATOR' || !current.isActive) return false

  const stillActiveAdmin = nextIsActive && (nextRole ?? current.role) === 'ADMINISTRATOR'
  if (stillActiveAdmin) return false

  const otherActiveAdmins = await prisma.user.count({
    where: { role: 'ADMINISTRATOR', isActive: true, id: { not: userId } },
  })
  return otherActiveAdmins === 0
}

usersRouter.get('/', ...requireAdmin, async (request, response, next) => {
  try {
    const query = request.query as Record<string, unknown>
    const search = typeof query.search === 'string' ? query.search.trim() : ''
    const role = typeof query.role === 'string' && (ROLES as readonly string[]).includes(query.role) ? (query.role as Role) : undefined
    const isActive = query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined

    const pageRaw = toInteger(query.page)
    const pageSizeRaw = toInteger(query.pageSize)
    const page = Math.max(DEFAULT_PAGE, pageRaw ?? DEFAULT_PAGE)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw ?? DEFAULT_PAGE_SIZE))

    const where = {
      ...(role ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [users, totalItems] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ])

    response.status(200).json({
      data: users.map(toUserResponse),
      meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    })
  } catch (error) {
    next(error)
  }
})

usersRouter.post('/', ...requireAdmin, async (request, response, next) => {
  try {
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const role = request.body?.role

    const fields: FieldErrors = {}
    if (!name) fields.name = 'Name is required.'
    if (!email) fields.email = 'Email is required.'
    if (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role)) fields.role = 'Role is invalid.'
    if (Object.keys(fields).length > 0) {
      response.status(400).json({ error: 'VALIDATION_FAILED', fields })
      return
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      response.status(400).json({ error: 'EMAIL_TAKEN' })
      return
    }

    const { user, initialPassword } = await userService.createUser({ name, email, role: role as Role })
    response.status(201).json({ ...toUserResponse(user), initialPassword })
  } catch (error) {
    next(error)
  }
})

usersRouter.patch('/:id', ...requireAdmin, async (request, response, next) => {
  try {
    const userId = toInteger(request.params.id)
    if (userId === null) {
      response.status(404).json({ error: 'USER_NOT_FOUND' })
      return
    }

    const current = await prisma.user.findUnique({ where: { id: userId } })
    if (!current) {
      response.status(404).json({ error: 'USER_NOT_FOUND' })
      return
    }

    const name = request.body?.name
    const role = request.body?.role
    const isActive = request.body?.isActive

    const fields: FieldErrors = {}
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) fields.name = 'Name is invalid.'
    if (role !== undefined && (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role))) {
      fields.role = 'Role is invalid.'
    }
    if (isActive !== undefined && typeof isActive !== 'boolean') fields.isActive = 'isActive must be a boolean.'
    if (Object.keys(fields).length > 0) {
      response.status(400).json({ error: 'VALIDATION_FAILED', fields })
      return
    }

    const nextIsActive = isActive ?? current.isActive
    const nextRole = (role as Role | undefined) ?? current.role

    if (await wouldRemoveLastActiveAdmin(userId, nextIsActive, nextRole)) {
      response.status(409).json({ error: 'LAST_ADMINISTRATOR', message: 'At least one active Administrator must remain.' })
      return
    }

    // Route any isActive transition through UserService so deactivation
    // always invalidates sessions (BR-L3-18), whether it happens via this
    // generic PATCH or the dedicated /deactivate action below.
    if (isActive === false && current.isActive) {
      await userService.deactivateUser(userId)
    } else if (isActive === true && !current.isActive) {
      await userService.activateUser(userId)
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined ? { name: (name as string).trim() } : {}),
        ...(role !== undefined ? { role: role as Role } : {}),
      },
    })

    response.status(200).json(toUserResponse(updated))
  } catch (error) {
    next(error)
  }
})

usersRouter.post('/:id/reset-password', ...requireAdmin, async (request, response, next) => {
  try {
    const userId = toInteger(request.params.id)
    if (userId === null) {
      response.status(404).json({ error: 'USER_NOT_FOUND' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } })
    if (!existing) {
      response.status(404).json({ error: 'USER_NOT_FOUND' })
      return
    }

    const { initialPassword } = await userService.resetPassword(userId)
    response.status(200).json({ id: userId, initialPassword })
  } catch (error) {
    next(error)
  }
})

usersRouter.post('/:id/deactivate', ...requireAdmin, async (request, response, next) => {
  try {
    const userId = toInteger(request.params.id)
    const callerId = response.locals.userId as number

    if (userId === null) {
      response.status(404).json({ error: 'USER_NOT_FOUND' })
      return
    }
    if (userId === callerId) {
      response.status(409).json({ error: 'SELF_DEACTIVATION', message: 'You cannot deactivate your own account.' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } })
    if (!existing) {
      response.status(404).json({ error: 'USER_NOT_FOUND' })
      return
    }

    if (!existing.isActive) {
      response.status(200).json({ id: userId, isActive: false })
      return
    }

    if (await wouldRemoveLastActiveAdmin(userId, false)) {
      response.status(409).json({ error: 'LAST_ADMINISTRATOR', message: 'At least one active Administrator must remain.' })
      return
    }

    const user = await userService.deactivateUser(userId)
    response.status(200).json({ id: user.id, isActive: user.isActive })
  } catch (error) {
    next(error)
  }
})

usersRouter.post('/:id/activate', ...requireAdmin, async (request, response, next) => {
  try {
    const userId = toInteger(request.params.id)
    if (userId === null) {
      response.status(404).json({ error: 'USER_NOT_FOUND' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } })
    if (!existing) {
      response.status(404).json({ error: 'USER_NOT_FOUND' })
      return
    }

    const user = await userService.activateUser(userId)
    response.status(200).json({ id: user.id, isActive: user.isActive })
  } catch (error) {
    next(error)
  }
})
