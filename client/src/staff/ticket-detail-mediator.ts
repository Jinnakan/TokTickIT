/**
 * Mediator: the Service Actions, Comments, and Notes panels on IT Staff
 * Ticket Detail don't hold references to each other. A claim, reassignment,
 * or status change from Service Actions changes what the ticket itself
 * looks like (owner, allowed next statuses), which Comments/Notes don't
 * need to know about directly -- they only need the ticket refetched so
 * the page stays consistent. Each panel reports what happened; the
 * mediator is the one place that decides what needs to refresh.
 */
export class TicketDetailMediator {
  constructor(private readonly refreshTicket: () => void) {}

  onClaimed(): void {
    this.refreshTicket()
  }

  onReassigned(): void {
    this.refreshTicket()
  }

  onPriorityChanged(): void {
    this.refreshTicket()
  }

  onStatusChanged(): void {
    this.refreshTicket()
  }
}
