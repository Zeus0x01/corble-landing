-- Phase B: a requester may hold only one PENDING request per task.
-- Enforced at the database level; application-level duplicate checks remain as backstop.
CREATE UNIQUE INDEX "HandoverRequest_task_requester_pending_key"
  ON "HandoverRequest"("taskId", "requesterId")
  WHERE "status" = 'PENDING';
