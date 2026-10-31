import type { Prisma } from '@prisma/client'
import type { ActionStatusValue } from '@toktickit/shared'

export type ActionFact = {
  status: ActionStatusValue
  followUpRequired: boolean
  followUpDoneAt: Date | null
}

export type Blocker =
  | { code: 'NO_COMPLETED_ACTION' }
  | { code: 'ACTIONS_STILL_OPEN'; count: number }
  | { code: 'FOLLOW_UP_OPEN'; count: number }

/** An open follow-up: required, not done, on an Action that is not Cancelled (api-spec §3). */
function isOpenFollowUp(action: ActionFact): boolean {
  return action.status !== 'CANCELLED' && action.followUpRequired && action.followUpDoneAt === null
}

/**
 * BR-L4-10: a Ticket may move to Resolved only with at least one Completed
 * Action, none Planned or In Progress, and no open required follow-up.
 * Pure on purpose: the same answer feeds the 409 and GET /api/tickets/:id.
 */
export function evaluateResolutionGate(actions: readonly ActionFact[]): Blocker[] {
  const blockers: Blocker[] = []
  if (!actions.some((action) => action.status === 'COMPLETED')) blockers.push({ code: 'NO_COMPLETED_ACTION' })

  const stillOpen = actions.filter((action) => action.status === 'PLANNED' || action.status === 'IN_PROGRESS').length
  if (stillOpen > 0) blockers.push({ code: 'ACTIONS_STILL_OPEN', count: stillOpen })

  const followUps = actions.filter(isOpenFollowUp).length
  if (followUps > 0) blockers.push({ code: 'FOLLOW_UP_OPEN', count: followUps })

  return blockers
}

export type ActionsSummary = {
  total: number
  planned: number
  inProgress: number
  completed: number
  cancelled: number
  openFollowUps: number
}

export function summarizeActions(actions: readonly ActionFact[]): ActionsSummary {
  const count = (status: ActionStatusValue) => actions.filter((action) => action.status === status).length
  return {
    total: actions.length,
    planned: count('PLANNED'),
    inProgress: count('IN_PROGRESS'),
    completed: count('COMPLETED'),
    cancelled: count('CANCELLED'),
    openFollowUps: actions.filter(isOpenFollowUp).length,
  }
}

export async function loadActionFacts(
  client: Pick<Prisma.TransactionClient, 'actionTaken'>,
  ticketId: number,
): Promise<ActionFact[]> {
  return client.actionTaken.findMany({
    where: { ticketId },
    select: { status: true, followUpRequired: true, followUpDoneAt: true },
  })
}
