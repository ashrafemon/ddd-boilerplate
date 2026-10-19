-- Inventory stock-movement ledger (Phase 5).
-- Natural idempotency: one movement per (grn_line, movement_type).

CREATE TABLE "inventory_movements" (
  "id"                  UUID         NOT NULL,
  "grn_line_id"         UUID         NOT NULL,
  "product_id"          UUID         NOT NULL,
  "quantity"             INTEGER      NOT NULL,
  "movement_type"       VARCHAR(50)  NOT NULL,
  "source_document_id"  VARCHAR(200) NOT NULL,
  "source_document_type" VARCHAR(100) NOT NULL,
  "company_id"          VARCHAR(100) NOT NULL,
  "tenant_id"           VARCHAR(100) NOT NULL,
  "actor_id"            VARCHAR(200),
  "effective_date"      TIMESTAMP(3) NOT NULL,
  "reversal_of_id"      UUID,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_movements_grn_line_id_movement_type_key"
  ON "inventory_movements" ("grn_line_id", "movement_type");
CREATE INDEX "inventory_movements_product_id_idx"
  ON "inventory_movements" ("product_id");
CREATE INDEX "inventory_movements_company_id_idx"
  ON "inventory_movements" ("company_id");
CREATE INDEX "inventory_movements_tenant_id_idx"
  ON "inventory_movements" ("tenant_id");
