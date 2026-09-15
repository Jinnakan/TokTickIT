import type { TicketStatus } from '@prisma/client'

/**
 * State: one class per status (BR-L3-13). A branching if/switch over every
 * status pair doesn't scale as the workflow grows -- each state instead
 * only has to know its own allowed next states, and the factory below is
 * the only place that maps a status value to its state instance.
 */
export interface TicketState {
  readonly status: TicketStatus
  canTransitionTo(next: TicketStatus): boolean
  allowedActions(): TicketStatus[]
}

export abstract class BaseTicketState implements TicketState {
  abstract readonly status: TicketStatus
  protected abstract readonly allowedNext: readonly TicketStatus[]

  canTransitionTo(next: TicketStatus): boolean {
    return (this.allowedNext as TicketStatus[]).includes(next)
  }

  allowedActions(): TicketStatus[] {
    return [...this.allowedNext]
  }
}
