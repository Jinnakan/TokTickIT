import { BaseTicketState } from './ticket-state.js'

/** Terminal state -- no outbound transitions (BR-L3-13). */
export class CancelledState extends BaseTicketState {
  readonly status = 'CANCELLED' as const
  protected readonly allowedNext = [] as const
}
