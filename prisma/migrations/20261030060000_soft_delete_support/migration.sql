-- Phase A: soft-delete support.
-- Tasks are never hard-deleted (history must survive); deactivated users keep rows.
ALTER TABLE "Task" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Task_deletedAt_idx" ON "Task"("deletedAt");
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
