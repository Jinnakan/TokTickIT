-- Rollback for the Lab 4 migration. Not run automatically.
-- Drops only what the migration added; earlier data is untouched.
DROP TABLE "ActionTaken";
DROP TABLE "TicketStatusHistory";
DROP TYPE "ActionStatus";
DROP INDEX "Ticket_currentStatus_idx";
DROP INDEX "Ticket_updatedAt_idx";
DROP INDEX "Ticket_requesterId_currentStatus_idx";
ALTER TABLE "Ticket" DROP COLUMN "requesterResolvedAt";
ALTER TABLE "Ticket" DROP COLUMN "version";
