-- GoodReceiptNote actor trail (plan Phase 1.2) + compensating-reversal link
-- (plan Phase 4.1, GRN-05). Additive and nullable; historical rows are NOT
-- backfilled (pending decision E-4: add nullable now, backfill nothing).
ALTER TABLE "good_receipt_notes"
  ADD COLUMN IF NOT EXISTS "reversalOfId" UUID,
  ADD COLUMN IF NOT EXISTS "createdBy" TEXT,
  ADD COLUMN IF NOT EXISTS "receivedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "postedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;

-- reversalOfId is set on the REVERSAL document only; NULL for originals.
CREATE INDEX IF NOT EXISTS "good_receipt_notes_reversalOfId_idx"
  ON "good_receipt_notes"("reversalOfId");

ALTER TABLE "good_receipt_notes"
  ADD CONSTRAINT "good_receipt_notes_reversalOfId_fkey"
  FOREIGN KEY ("reversalOfId") REFERENCES "good_receipt_notes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
