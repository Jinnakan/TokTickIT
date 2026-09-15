import { BaseTicketState } from './ticket-state.js'

export class ResolvedState extends BaseTicketState {
  readonly status = 'RESOLVED' as const
  protected readonly allowedNext = ['CLOSED', 'REOPENED'] as const
}
