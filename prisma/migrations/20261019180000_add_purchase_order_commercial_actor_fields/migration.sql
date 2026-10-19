-- PurchaseOrder commercial header (spec §3.1) + actor/approval trail
-- (plan Phase 1.2 / 2.3). Additive and nullable; historical rows are NOT
-- backfilled (pending decision E-4: add nullable now, backfill nothing).
ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "orderDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expectedDeliveryDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdBy" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "issuedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;

-- Line-level commercial snapshot (spec §3.2/§3.3): product master renames must
-- not silently change an existing PO's agreed description. NULL = legacy row.
ALTER TABLE "purchase_order_lines"
  ADD COLUMN IF NOT EXISTS "descriptionSnapshot" TEXT;
