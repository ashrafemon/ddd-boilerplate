-- Align Saga with design 08: replace the old (never-migrated) saga model set with
-- the five-table company-configurable orchestration model.
--
--   saga_definitions / saga_company_configs / saga_instances / saga_steps / saga_inbox
--
-- Partial unique indexes are hand-written: Prisma cannot express "one ACTIVE per
-- key" or the "one live instance per correlation key" constraint.

-- ─── Enums ──────────────────────────────────────────────────────────────────
CREATE TYPE "saga_definition_status" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "saga_company_config_status" AS ENUM ('ACTIVE', 'INVALID', 'RETIRED');
CREATE TYPE "saga_instance_state" AS ENUM (
  'RUNNING', 'WAITING', 'COMPENSATING', 'COMPLETED', 'COMPENSATED', 'CANCELLED', 'FAILED_MANUAL'
);
CREATE TYPE "saga_instance_reason" AS ENUM (
  'STEP_FAILED', 'TIMEOUT', 'CANCELLED_BY_EVENT', 'CANCELLED_BY_USER'
);
CREATE TYPE "saga_step_kind" AS ENUM ('DO', 'WAIT', 'UNDO');
CREATE TYPE "saga_step_state" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'SKIPPED', 'FAILED');
CREATE TYPE "saga_inbox_state" AS ENUM ('RECEIVED', 'BUFFERED', 'CONSUMED', 'IGNORED');

-- ─── saga_definitions ───────────────────────────────────────────────────────
CREATE TABLE "saga_definitions" (
  "id"            UUID         NOT NULL,
  "saga_key"      VARCHAR(200) NOT NULL,
  "version"       INTEGER      NOT NULL,
  "event_name"    VARCHAR(250) NOT NULL,
  "event_version" INTEGER      NOT NULL,
  "status"        "saga_definition_status" NOT NULL DEFAULT 'DRAFT',
  "definition"    JSONB        NOT NULL,
  "created_by"    VARCHAR(200),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saga_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saga_definitions_saga_key_version_key"
  ON "saga_definitions" ("saga_key", "version");
CREATE INDEX "saga_definitions_event_name_event_version_status_idx"
  ON "saga_definitions" ("event_name", "event_version", "status");
-- one ACTIVE definition per saga key
CREATE UNIQUE INDEX "saga_definitions_one_active"
  ON "saga_definitions" ("saga_key") WHERE "status" = 'ACTIVE';

-- ─── saga_company_configs ───────────────────────────────────────────────────
CREATE TABLE "saga_company_configs" (
  "id"              UUID         NOT NULL,
  "tenant_id"       VARCHAR(100) NOT NULL,
  "company_id" VARCHAR(100) NOT NULL,
  "definition_id"   UUID         NOT NULL,
  "saga_key"        VARCHAR(200) NOT NULL,
  "version"         INTEGER      NOT NULL DEFAULT 1,
  "base_version"    INTEGER      NOT NULL,
  "overlay"         JSONB        NOT NULL,
  "status"          "saga_company_config_status" NOT NULL DEFAULT 'ACTIVE',
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saga_company_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saga_company_configs_company_id_saga_key_version_key"
  ON "saga_company_configs" ("company_id", "saga_key", "version");
CREATE INDEX "saga_company_configs_tenant_id_company_id_saga_key_status_idx"
  ON "saga_company_configs" ("tenant_id", "company_id", "saga_key", "status");
-- one ACTIVE overlay per (company, saga key)
CREATE UNIQUE INDEX "saga_company_configs_one_active"
  ON "saga_company_configs" ("company_id", "saga_key") WHERE "status" = 'ACTIVE';

-- ─── saga_instances ─────────────────────────────────────────────────────────
CREATE TABLE "saga_instances" (
  "id"                  UUID         NOT NULL,
  "tenant_id"           VARCHAR(100) NOT NULL,
  "company_id"     VARCHAR(100) NOT NULL,
  "saga_key"            VARCHAR(200) NOT NULL,
  "definition_id"       UUID         NOT NULL,
  "config_id"           UUID,
  "root_ref_type"       VARCHAR(200),
  "root_ref_id"         VARCHAR(200),
  "correlation_key"     VARCHAR(250) NOT NULL,
  "status"              "saga_instance_state" NOT NULL DEFAULT 'RUNNING',
  "reason"              "saga_instance_reason",
  "plan"                JSONB        NOT NULL,
  "context"             JSONB        NOT NULL,
  "cursor"              INTEGER      NOT NULL DEFAULT 0,
  "waiting_event"       VARCHAR(250),
  "cancel_requested_at" TIMESTAMP(3),
  "error"               TEXT,
  "deadline_at"         TIMESTAMP(3),
  "version"             INTEGER      NOT NULL DEFAULT 1,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saga_instances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "saga_instances_tenant_id_company_id_status_idx"
  ON "saga_instances" ("tenant_id", "company_id", "status");
CREATE INDEX "saga_instances_tenant_id_company_id_saga_key_status_idx"
  ON "saga_instances" ("tenant_id", "company_id", "saga_key", "status");
CREATE INDEX "saga_instances_saga_key_correlation_key_idx"
  ON "saga_instances" ("saga_key", "correlation_key");
-- one live instance per (tenant, company, saga key, correlation key)
CREATE UNIQUE INDEX "saga_instances_one_live"
  ON "saga_instances" ("tenant_id", "company_id", "saga_key", "correlation_key")
  WHERE "status" IN ('RUNNING', 'WAITING', 'COMPENSATING');

-- ─── saga_steps ─────────────────────────────────────────────────────────────
CREATE TABLE "saga_steps" (
  "id"              UUID         NOT NULL,
  "tenant_id"       VARCHAR(100) NOT NULL,
  "company_id" VARCHAR(100) NOT NULL,
  "instance_id"     UUID         NOT NULL,
  "step_id"         VARCHAR(200) NOT NULL,
  "kind"            "saga_step_kind" NOT NULL,
  "action"          VARCHAR(250),
  "status"          "saga_step_state" NOT NULL DEFAULT 'PENDING',
  "attempt"         INTEGER      NOT NULL DEFAULT 0,
  "max_attempts"    INTEGER      NOT NULL,
  "run_at"          TIMESTAMP(3) NOT NULL,
  "locked_by"       VARCHAR(200),
  "lock_until"      TIMESTAMP(3),
  "input"           JSONB,
  "output"          JSONB,
  "error"           TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saga_steps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saga_steps_instance_id_step_id_kind_key"
  ON "saga_steps" ("instance_id", "step_id", "kind");
CREATE INDEX "saga_steps_status_run_at_idx" ON "saga_steps" ("status", "run_at");
CREATE INDEX "saga_steps_company_id_status_idx"
  ON "saga_steps" ("company_id", "status");
-- runnable queue scan
CREATE INDEX "saga_steps_pending_run_at" ON "saga_steps" ("run_at") WHERE "status" = 'PENDING';

-- ─── saga_inbox ─────────────────────────────────────────────────────────────
CREATE TABLE "saga_inbox" (
  "id"              UUID         NOT NULL,
  "tenant_id"       VARCHAR(100) NOT NULL,
  "company_id" VARCHAR(100) NOT NULL,
  "consumer"        VARCHAR(200) NOT NULL,
  "event_id"        UUID         NOT NULL,
  "event_name"      VARCHAR(250) NOT NULL,
  "event_version"   INTEGER      NOT NULL,
  "correlation_key" VARCHAR(250),
  "instance_id"     UUID,
  "payload"         JSONB        NOT NULL,
  "status"          "saga_inbox_state" NOT NULL DEFAULT 'RECEIVED',
  "reason"          VARCHAR(250),
  "received_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at"    TIMESTAMP(3),
  CONSTRAINT "saga_inbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saga_inbox_tenant_id_company_id_consumer_event_id_key"
  ON "saga_inbox" ("tenant_id", "company_id", "consumer", "event_id");
CREATE INDEX "saga_inbox_instance_id_status_idx" ON "saga_inbox" ("instance_id", "status");
