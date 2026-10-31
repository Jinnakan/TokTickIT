import type { ActionStatusValue } from '@toktickit/shared'

export type ActionTaken = {
  id: number
  ticketId: number
  version: number
  actionAt: string
  description: string
  result: string | null
  status: ActionStatusValue
  createdById: number
  createdByName: string
  assigneeId: number
  assigneeName: string
  followUpRequired: boolean
  followUpNote: string | null
  followUpDoneAt: string | null
  attachmentNotes: string | null
  createdAt: string
  updatedAt: string
}

export const SAVE_FAILED_MESSAGE = 'Unable to save the action. Your text is still here.'

export class ActionApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
    readonly detail: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  STALE_UPDATE: 'This action was changed by someone else. Reload to see the latest.',
  TICKET_LOCKED: 'This ticket is closed, so actions can no longer be changed.',
  ACTION_LOCKED: 'This action can no longer be changed.',
  INVALID_ACTION_TRANSITION: 'That status change is not allowed for this action.',
  ACTION_NOT_FOUND: 'This action no longer exists. Reload to see the latest.',
  TICKET_NOT_FOUND: 'This ticket no longer exists.',
  FORBIDDEN: 'You cannot change actions on this ticket.',
  TICKET_FORBIDDEN: 'You do not have access to this ticket.',
}

async function readError(response: Response, fallback: string): Promise<ActionApiError> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string
    fields?: Record<string, string>
    [key: string]: unknown
  }
  const code = body.error ?? 'UNKNOWN_ERROR'
  return new ActionApiError(code, ERROR_MESSAGES[code] ?? fallback, body.fields ?? {}, body)
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function fetchActions(ticketId: number, signal?: AbortSignal): Promise<ActionTaken[]> {
  const response = await fetch(`/api/tickets/${ticketId}/actions`, { credentials: 'include', signal })
  if (!response.ok) throw await readError(response, 'Unable to load the actions.')
  return response.json() as Promise<ActionTaken[]>
}

export async function createAction(ticketId: number, payload: Record<string, unknown>): Promise<ActionTaken> {
  const response = await fetch(`/api/tickets/${ticketId}/actions`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw await readError(response, SAVE_FAILED_MESSAGE)
  return response.json() as Promise<ActionTaken>
}

export async function updateAction(
  ticketId: number,
  actionId: number,
  payload: Record<string, unknown>,
): Promise<ActionTaken> {
  const response = await fetch(`/api/tickets/${ticketId}/actions/${actionId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw await readError(response, SAVE_FAILED_MESSAGE)
  return response.json() as Promise<ActionTaken>
}
