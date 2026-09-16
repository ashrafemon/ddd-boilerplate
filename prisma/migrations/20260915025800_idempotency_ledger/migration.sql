-- Platform idempotency reservation ledger (idempotency_keys).
CREATE TYPE "idempotency_status" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "idempotency_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "result" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_keys_scope_tenantId_key_key" ON "idempotency_keys"("scope", "tenantId", "key");

CREATE INDEX "idempotency_keys_status_expiresAt_idx" ON "idempotency_keys"("status", "expiresAt");
