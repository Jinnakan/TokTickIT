import type { ActionTaken, Prisma } from '@prisma/client'
import {
  ASSIGNEE_ERROR_MESSAGE,
  evaluateActionEdit,
  parseActionBody,
  pickActionBody,
  type ActionDraft,
} from '@toktickit/shared'
import { prisma } from '../prisma.js'
import { lockTicket } from '../tickets/lock-ticket.js'
import { reply, validationFailed, type ServiceResult } from '../tickets/service-result.js'
import { touchTicket } from '../tickets/touch-ticket.js'
import { findAssignableUser } from '../users/assignable-roles.js'


const WITH_NAMES = {
  createdBy: { select: { name: true } },
  assignee: { select: { name: true } },
} satisfies Prisma.ActionTakenInclude
type ActionWithNames = Prisma.ActionTakenGetPayload<{ include: typeof WITH_NAMES }>

const LOCKED_TICKET_STATUSES: readonly string[] = ['CLOSED', 'CANCELLED']

export function toActionResponse(action: ActionWithNames) {
  return {
    id: action.id,
    ticketId: action.ticketId,
    version: action.version,
    actionAt: action.actionAt,
    description: action.description,
    result: action.result,
    status: action.status,
    createdById: action.createdById,
    createdByName: action.createdBy.name,
    assigneeId: action.assigneeId,
    assigneeName: action.assignee.name,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    followUpDoneAt: action.followUpDoneAt,
    attachmentNotes: action.attachmentNotes,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
  }
}

function toDraft(action: ActionTaken): ActionDraft {
  return {
    description: action.description,
    status: action.status,
    result: action.result,
    actionAt: action.actionAt,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
  }
}

export async function listActions(ticketId: number) {
  const actions = await prisma.actionTaken.findMany({
    where: { ticketId },
    orderBy: [{ actionAt: 'asc' }, { id: 'asc' }],
    include: WITH_NAMES,
  })
  return actions.map(toActionResponse)
}

export async function createAction(ticketId: number, creatorId: number, rawBody: unknown): Promise<ServiceResult> {
  const body = pickActionBody(rawBody)

  return prisma.$transaction(async (tx) => {
    const ticket = await lockTicket(tx, ticketId)
    if (!ticket) return reply(404, { error: 'TICKET_NOT_FOUND' })

    const now = new Date()
    const parsed = parseActionBody(body, null, now)

    if (parsed.requestId) {
      const original = await tx.actionTaken.findUnique({
        where: { ticketId_requestId: { ticketId, requestId: parsed.requestId } },
        include: WITH_NAMES,
      })
      if (original) return reply(200, toActionResponse(original))
    }

    if (LOCKED_TICKET_STATUSES.includes(ticket.currentStatus)) {
      return reply(409, { error: 'TICKET_LOCKED', currentStatus: ticket.currentStatus })
    }
    if (Object.keys(parsed.fields).length > 0) return validationFailed(parsed.fields)

    const assigneeId = parsed.assigneeId ?? creatorId
    if (parsed.assigneeId !== undefined && !(await findAssignableUser(tx, parsed.assigneeId))) {
      return validationFailed({ assigneeId: ASSIGNEE_ERROR_MESSAGE })
    }

    const created = await tx.actionTaken.create({
      data: {
        ticketId,
        createdById: creatorId,
        assigneeId,
        ...parsed.draft,
        followUpDoneAt: parsed.followUpDone ? now : null,
        requestId: parsed.requestId ?? null,
      },
      include: WITH_NAMES,
    })
    await touchTicket(tx, ticketId)
    return reply(201, toActionResponse(created))
  })
}

export async function updateAction(ticketId: number, actionId: number, rawBody: unknown): Promise<ServiceResult> {
  const body = pickActionBody(rawBody)

  return prisma.$transaction(async (tx) => {
    const ticket = await lockTicket(tx, ticketId)
    if (!ticket) return reply(404, { error: 'TICKET_NOT_FOUND' })

    const existing = await tx.actionTaken.findFirst({ where: { id: actionId, ticketId } })
    if (!existing) return reply(404, { error: 'ACTION_NOT_FOUND' })

    const version = body.version
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      return validationFailed({ version: 'Version is required.' })
    }
    if (LOCKED_TICKET_STATUSES.includes(ticket.currentStatus)) {
      return reply(409, { error: 'TICKET_LOCKED', currentStatus: ticket.currentStatus })
    }
    if (version !== existing.version) {
      return reply(409, { error: 'STALE_UPDATE', currentVersion: existing.version })
    }

    const problem = evaluateActionEdit(existing.status, body)
    if (problem) return reply(409, problem)

    const now = new Date()
    const parsed = parseActionBody(body, toDraft(existing), now)
    if (Object.keys(parsed.fields).length > 0) return validationFailed(parsed.fields)

    if (
      parsed.assigneeId !== undefined &&
      parsed.assigneeId !== existing.assigneeId &&
      !(await findAssignableUser(tx, parsed.assigneeId))
    ) {
      return validationFailed({ assigneeId: ASSIGNEE_ERROR_MESSAGE })
    }

    let followUpDoneAt = existing.followUpDoneAt
    if (!parsed.draft.followUpRequired) followUpDoneAt = null
    else if (parsed.followUpDone === true && followUpDoneAt === null) followUpDoneAt = now
    else if (parsed.followUpDone === false) followUpDoneAt = null

    const updated = await tx.actionTaken.update({
      where: { id: actionId, version: existing.version },
      data: {
        ...parsed.draft,
        assigneeId: parsed.assigneeId ?? existing.assigneeId,
        followUpDoneAt,
        version: { increment: 1 },
      },
      include: WITH_NAMES,
    })
    await touchTicket(tx, ticketId)
    return reply(200, toActionResponse(updated))
  })
}
