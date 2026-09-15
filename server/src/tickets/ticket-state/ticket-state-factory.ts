import type { TicketStatus } from '@prisma/client'
import type { TicketState } from './ticket-state.js'
import { NewState } from './new-state.js'
import { OpenState } from './open-state.js'
import { InProgressState } from './in-progress-state.js'
import { WaitingForRequesterState } from './waiting-for-requester-state.js'
import { ResolvedState } from './resolved-state.js'
import { ClosedState } from './closed-state.js'
import { ReopenedState } from './reopened-state.js'
import { CancelledState } from './cancelled-state.js'

const STATES: Record<TicketStatus, TicketState> = {
  NEW: new NewState(),
  OPEN: new OpenState(),
  IN_PROGRESS: new InProgressState(),
  WAITING_FOR_REQUESTER: new WaitingForRequesterState(),
  RESOLVED: new ResolvedState(),
  CLOSED: new ClosedState(),
  REOPENED: new ReopenedState(),
  CANCELLED: new CancelledState(),
}

export function getTicketState(status: TicketStatus): TicketState {
  return STATES[status]
}
