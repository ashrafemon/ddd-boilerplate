-- Align outbox_messages with design 04:
--   * status enum drops PUBLISHING/FAILED (claims keep status=PENDING; the
--     lease is the in-flight marker) → PENDING | PUBLISHED | DEAD_LETTER
--   * available_at renamed to next_retry_at (nullable; drives backoff)
--   * index follows the claim predicate (status, next_retry_at)

-- 1. Rename the backoff column (keep values; NULL means "due immediately").
ALTER TABLE "outbox_messages" RENAME COLUMN "available_at" TO "next_retry_at";
ALTER TABLE "outbox_messages" ALTER COLUMN "next_retry_at" DROP NOT NULL;
ALTER TABLE "outbox_messages" ALTER COLUMN "next_retry_at" DROP DEFAULT;

-- 2. Collapse the old in-flight/retry statuses back to PENDING.
ALTER TABLE "outbox_messages" ALTER COLUMN "status" DROP DEFAULT;
UPDATE "outbox_messages" SET "status" = 'PENDING' WHERE "status"::text IN ('PUBLISHING', 'FAILED');

-- 3. Swap the enum type (Postgres has no DROP VALUE).
CREATE TYPE "OutboxMessageStatus_new" AS ENUM ('PENDING', 'PUBLISHED', 'DEAD_LETTER');
ALTER TABLE "outbox_messages"
  ALTER COLUMN "status" TYPE "OutboxMessageStatus_new"
  USING ("status"::text::"OutboxMessageStatus_new");
DROP TYPE "OutboxMessageStatus";
ALTER TYPE "OutboxMessageStatus_new" RENAME TO "OutboxMessageStatus";
ALTER TABLE "outbox_messages" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- 4. Rebuild the claim index to match the new predicate.
DROP INDEX IF EXISTS "outbox_messages_status_available_at_idx";
CREATE INDEX "outbox_messages_status_next_retry_at_idx"
  ON "outbox_messages" ("status", "next_retry_at");
