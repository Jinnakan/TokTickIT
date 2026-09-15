import { BaseTicketState } from './ticket-state.js'

export class InProgressState extends BaseTicketState {
  readonly status = 'IN_PROGRESS' as const
  protected readonly allowedNext = ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'] as const
}
