-- Platform hardening: outbox claim safety + tenancy + retry gating,
-- batch/import execution fencing tokens, per-tenant recurring number space.

-- ============================================================================
-- Transactional Outbox (outbox_messages)
-- ============================================================================

-- AlterTable: tenant stamping + claim lease + backoff gating
ALTER TABLE "outbox_messages" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "outbox_messages" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "outbox_messages" ADD COLUMN "nextRetryAt" TIMESTAMP(3);

-- CreateEnumValue: terminal poison-message state (PG12+: adding inside a
-- transaction is allowed as long as the value is not used in this tx).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OutboxMessageStatus' AND e.enumlabel = 'DEAD_LETTER'
  ) THEN
    ALTER TYPE "OutboxMessageStatus" ADD VALUE 'DEAD_LETTER';
  END IF;
END $$;

-- DropIndex / CreateIndex: claim query is now
--   WHERE status IN ('PENDING','FAILED') AND attempts < max AND due
--   ORDER BY createdAt  FOR UPDATE SKIP LOCKED
CREATE INDEX "outbox_messages_status_createdAt_idx" ON "outbox_messages"("status", "createdAt");
CREATE INDEX "outbox_messages_status_claimedAt_idx" ON "outbox_messages"("status", "claimedAt");
CREATE INDEX "outbox_messages_tenantId_status_createdAt_idx" ON "outbox_messages"("tenantId", "status", "createdAt");
DROP INDEX "outbox_messages_status_publishedAt_idx";

-- ============================================================================
-- Batch operations (batch_operation_job_rows): fencing token per claim
-- ============================================================================
ALTER TABLE "batch_operation_job_rows" ADD COLUMN "claimToken" INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- Import (import_job_rows): fencing token per execution claim
-- ============================================================================
ALTER TABLE "import_job_rows" ADD COLUMN "executionClaimToken" INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- Recurring templates: per-tenant number space with no cross-tenant oracle
-- ============================================================================
DROP INDEX "recurring_templates_templateNo_key";
CREATE UNIQUE INDEX "recurring_templates_tenantId_templateNo_key" ON "recurring_templates"("tenantId", "templateNo");
