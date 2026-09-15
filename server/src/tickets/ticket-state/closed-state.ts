import { BaseTicketState } from './ticket-state.js'

export class ClosedState extends BaseTicketState {
  readonly status = 'CLOSED' as const
  protected readonly allowedNext = ['REOPENED'] as const
}
