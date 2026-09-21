-- Purchase order import: caller-supplied reference used to group import rows into one PO
-- and to make re-imports idempotent (find-or-create). NULL for POs created any other way.
ALTER TABLE "purchase_orders" ADD COLUMN "externalReference" VARCHAR(128);

-- Postgres unique indexes allow many NULLs, so only referenced POs are constrained.
CREATE UNIQUE INDEX "purchase_orders_externalReference_key" ON "purchase_orders"("externalReference");
