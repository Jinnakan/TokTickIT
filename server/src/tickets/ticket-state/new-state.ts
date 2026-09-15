import { BaseTicketState } from './ticket-state.js'

export class NewState extends BaseTicketState {
  readonly status = 'NEW' as const
  protected readonly allowedNext = ['OPEN', 'CANCELLED'] as const
}
