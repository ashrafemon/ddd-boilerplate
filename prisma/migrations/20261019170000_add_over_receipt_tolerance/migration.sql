-- Add over_receipt_tolerance to company_configs (additive, backfilled with default).
ALTER TABLE "company_configs"
  ADD COLUMN IF NOT EXISTS "over_receipt_tolerance" DECIMAL(5, 4) NOT NULL DEFAULT 0.1;

UPDATE "company_configs" SET "over_receipt_tolerance" = 0.1 WHERE "over_receipt_tolerance" IS NULL;
