import { BaseTicketState } from './ticket-state.js'

export class WaitingForRequesterState extends BaseTicketState {
  readonly status = 'WAITING_FOR_REQUESTER' as const
  protected readonly allowedNext = ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'] as const
}
