import { BaseTicketState } from './ticket-state.js'

export class ReopenedState extends BaseTicketState {
  readonly status = 'REOPENED' as const
  protected readonly allowedNext = ['IN_PROGRESS', 'CANCELLED'] as const
}
