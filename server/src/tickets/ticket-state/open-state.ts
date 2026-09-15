import { BaseTicketState } from './ticket-state.js'

export class OpenState extends BaseTicketState {
  readonly status = 'OPEN' as const
  protected readonly allowedNext = ['IN_PROGRESS', 'CANCELLED'] as const
}
