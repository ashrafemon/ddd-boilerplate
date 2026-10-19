-- Stock balance PROJECTION (plan Phase 5.2): derived from inventory_movements,
-- upserted in the same transaction as each movement insert (GRN-04).
-- Existing ledgers are reconciled into the projection (backfill-before-read).
CREATE TABLE "stock_balances" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "company_id" VARCHAR(100) NOT NULL,
    "tenant_id" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_balances_product_id_company_id_tenant_id_key"
  ON "stock_balances"("product_id", "company_id", "tenant_id");

-- Backfill: project the existing ledger so reads are correct from day one.
INSERT INTO "stock_balances" ("id", "product_id", "company_id", "tenant_id", "quantity", "updated_at")
SELECT
  gen_random_uuid(),
  m."product_id",
  m."company_id",
  m."tenant_id",
  SUM(m."quantity"),
  CURRENT_TIMESTAMP
FROM "inventory_movements" m
GROUP BY m."product_id", m."company_id", m."tenant_id"
ON CONFLICT ("product_id", "company_id", "tenant_id") DO NOTHING;
