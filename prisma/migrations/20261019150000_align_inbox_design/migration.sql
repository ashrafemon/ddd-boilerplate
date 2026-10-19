-- Align Inbox with design 07: consumer-side deduplication.
--
--   inbox_messages  insert-as-claim on (tenant, company, consumer, message_id);
--                   statuses IN_PROGRESS | PROCESSED | SUSPENDED only.
--
-- The table was declared in the schema but never migrated; this migration
-- creates it in its aligned shape.

CREATE TYPE "inbox_message_status" AS ENUM ('IN_PROGRESS', 'PROCESSED', 'SUSPENDED');

CREATE TABLE "inbox_messages" (
  "id"              UUID         NOT NULL,
  "tenant_id"       VARCHAR(100) NOT NULL DEFAULT '',
  "organization_id" VARCHAR(100) NOT NULL DEFAULT '',
  "consumer"        VARCHAR(250) NOT NULL,
  "message_id"      VARCHAR(500) NOT NULL,
  "message_type"    VARCHAR(250) NOT NULL,
  "payload"         JSONB        NOT NULL,
  "status"          "inbox_message_status" NOT NULL DEFAULT 'IN_PROGRESS',
  "attempts"        INTEGER      NOT NULL DEFAULT 1,
  "claim_token"     UUID         NOT NULL,
  "claimed_at"      TIMESTAMP(3),
  "processed_at"    TIMESTAMP(3),
  "next_attempt_at" TIMESTAMP(3),
  "last_error"      TEXT,
  "correlation_id"  VARCHAR(200),
  "causation_id"    VARCHAR(200),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inbox_messages_tenant_id_organization_id_consumer_message_i_key"
  ON "inbox_messages" ("tenant_id", "organization_id", "consumer", "message_id");
CREATE INDEX "inbox_messages_status_next_attempt_at_idx"
  ON "inbox_messages" ("status", "next_attempt_at");
