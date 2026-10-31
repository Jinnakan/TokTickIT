# 0001. Version number plus a Ticket row lock for concurrent writes

## Context
Two staff can edit the same Ticket or Action at once, and the resolution gate
reads other rows (Actions) while a status change writes the Ticket. A version
check on the Ticket alone cannot stop an Action being added while another user
resolves it.

## Decision
Ticket and Action carry an integer `version`. Writes send the version they saw and
fail with `STALE_UPDATE` if it changed. Any write that can change the gate's
answer runs in one transaction that first runs `SELECT ... FOR UPDATE` on the
Ticket row (`tickets/lock-ticket.ts`) and then re-reads what it needs.

## Consequences
- Concurrent writes on one Ticket run one after the other; the second sees the first.
- No lock is held while a person types, only for the short write.
- A test can prove it deterministically: hold the lock in a test transaction, fire the
  request, add an Action under the lock, and the request must then be blocked.

## Alternatives considered
- Compare `updatedAt`: ties and JSON round-tripping make it unreliable.
- Retry loops without a lock: cannot protect a rule that reads other rows.
