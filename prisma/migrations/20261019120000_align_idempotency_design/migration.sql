-- Align idempotency_keys with design common/02-idempotency:
--   status: IN_PROGRESS | COMPLETED only
--   fail() deletes the row (no FAILED/SUSPENDED parking lot)
--   no error_code / error_message columns
--
-- Legacy FAILED/SUSPENDED rows are folded back to IN_PROGRESS before the
-- enum is retyped, so the cast never fails on existing data.

UPDATE "idempotency_keys"
SET "status" = 'IN_PROGRESS'
WHERE "status"::text IN ('FAILED', 'SUSPENDED');

ALTER TABLE "idempotency_keys" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "idempotency_keys" ALTER COLUMN "status" TYPE TEXT USING ("status"::text);
DROP TYPE IF EXISTS "idempotency_status";
CREATE TYPE "idempotency_status" AS ENUM ('IN_PROGRESS', 'COMPLETED');
ALTER TABLE "idempotency_keys"
  ALTER COLUMN "status" TYPE "idempotency_status" USING ("status"::"idempotency_status");
ALTER TABLE "idempotency_keys" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';

ALTER TABLE "idempotency_keys" DROP COLUMN IF EXISTS "error_code";
ALTER TABLE "idempotency_keys" DROP COLUMN IF EXISTS "error_message";
