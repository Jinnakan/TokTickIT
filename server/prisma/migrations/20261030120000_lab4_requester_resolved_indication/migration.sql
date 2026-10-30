-- Lab 4, Issue 24: advisory "problem appears resolved" indication.
-- Additive only: one nullable column, no data change. Existing Tickets get NULL.
ALTER TABLE "Ticket" ADD COLUMN "requesterResolvedAt" TIMESTAMP(3);
