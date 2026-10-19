-- inventory_movements.grn_line_id holds the synthetic SOURCE LINE reference
-- `${grnId}:${productId}` (GRN lines are identified by the composite
-- (grnId, productId); the domain has no surrogate line id). It was wrongly
-- typed uuid, which made every GoodsReceiptPosted insert fail at the DB.
-- uuid → TEXT is a widening cast: existing uuid values remain valid text.
ALTER TABLE "inventory_movements" ALTER COLUMN "grn_line_id" TYPE TEXT;
