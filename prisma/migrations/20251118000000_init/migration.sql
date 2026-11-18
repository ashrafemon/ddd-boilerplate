-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BatchOperationMode" AS ENUM ('SYNC', 'ASYNC');

-- CreateEnum
CREATE TYPE "BatchOperationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchOperationRowStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "idempotency_status" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StorageObjectPurpose" AS ENUM ('IMPORT_SOURCE', 'IMPORT_ERROR_REPORT', 'EXPORT_RESULT', 'OTHER');

-- CreateEnum
CREATE TYPE "StorageScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'PARSING', 'MAPPED', 'VALIDATING', 'VALIDATED', 'EXECUTING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportRowValidationStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "ImportRowExecutionStatus" AS ENUM ('PENDING', 'PROCESSING', 'APPLIED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "inbox_message_status" AS ENUM ('IN_PROGRESS', 'PROCESSED', 'FAILED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "NotificationMode" AS ENUM ('SYNC', 'ASYNC');

-- CreateEnum
CREATE TYPE "NotificationRequestStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'NO_RECIPIENTS');

-- CreateEnum
CREATE TYPE "NotificationMessageStatus" AS ENUM ('PENDING', 'RENDERING', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "OutboxMessageStatus" AS ENUM ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "RecurringTemplateStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RecurringTriggerType" AS ENUM ('TIME', 'EVENT');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurringPartyType" AS ENUM ('CUSTOMER', 'VENDOR', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "RecurringExecutionStatus" AS ENUM ('IN_PROGRESS', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "saga_definition_status" AS ENUM ('DRAFT', 'ACTIVE', 'INVALID', 'RETIRED');

-- CreateEnum
CREATE TYPE "saga_instance_state" AS ENUM ('RUNNING', 'WAITING', 'COMPENSATING', 'COMPLETED', 'COMPENSATED', 'CANCELLED', 'FAILED_MANUAL');

-- CreateEnum
CREATE TYPE "saga_instance_reason" AS ENUM ('STEP_FAILED', 'TIMEOUT', 'CANCELLED_BY_EVENT', 'CANCELLED_BY_USER');

-- CreateEnum
CREATE TYPE "saga_step_kind" AS ENUM ('DO', 'WAIT', 'UNDO');

-- CreateEnum
CREATE TYPE "saga_step_state" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "saga_inbox_state" AS ENUM ('RECEIVED', 'BUFFERED', 'CONSUMED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('PENDING', 'CLAIMED', 'RUNNING', 'FAILED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduledJobScope" AS ENUM ('AGGREGATE', 'TENANT', 'PLATFORM');

-- CreateEnum
CREATE TYPE "ScheduledJobScheduleMode" AS ENUM ('CRON', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ScheduledJobDispatchOutcome" AS ENUM ('SUCCESS', 'FAILED', 'DEAD_LETTERED');

-- CreateEnum
CREATE TYPE "webhook_subscription_status" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "webhook_delivery_status" AS ENUM ('PENDING', 'DELIVERING', 'DELIVERED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "GrnStatus" AS ENUM ('DRAFT', 'RECEIVED', 'POSTED', 'INSPECTED', 'MATCHED', 'COMPLETED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDINGAPPROVAL', 'APPROVED', 'ISSUED', 'HOLD', 'REVISION', 'PARTIALLYRECEIVED', 'FULLYRECEIVED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tenantId" TEXT,
    "companyId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_records" (
    "id" UUID NOT NULL,
    "doc_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "approver_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason_code" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_operation_jobs" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "companyId" TEXT,
    "branchId" TEXT,
    "jobNo" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "operationCode" TEXT NOT NULL,
    "operationParams" JSONB,
    "mode" "BatchOperationMode" NOT NULL,
    "status" "BatchOperationJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "successRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "skippedRecords" INTEGER NOT NULL DEFAULT 0,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "requestedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_operation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_operation_job_rows" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "batchOperationJobId" UUID NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "BatchOperationRowStatus" NOT NULL DEFAULT 'PENDING',
    "claimToken" INTEGER NOT NULL DEFAULT 0,
    "skipReason" TEXT,
    "errorMessage" TEXT,
    "resultSnapshot" JSONB,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "batch_operation_job_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_number_sequences" (
    "id" UUID NOT NULL,
    "company_code" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "doc_type" TEXT NOT NULL,
    "next_value" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(100) NOT NULL,
    "company_id" VARCHAR(100) NOT NULL,
    "scope" VARCHAR(200) NOT NULL,
    "idempotency_key" VARCHAR(500) NOT NULL,
    "request_hash" VARCHAR(128),
    "status" "idempotency_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "claim_token" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "result_json" JSONB,
    "claimed_at" TIMESTAMP(3),
    "lease_until" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_objects" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "storageKey" TEXT NOT NULL,
    "purpose" "StorageObjectPurpose" NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "scanStatus" "StorageScanStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "jobNo" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "descriptorVersion" INTEGER NOT NULL,
    "descriptorSnapshot" JSONB NOT NULL,
    "columnMapping" JSONB,
    "statusHistory" JSONB NOT NULL DEFAULT '[]',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "appliedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "sourceStorageObjectId" UUID,
    "errorReportStorageObjectId" UUID,
    "options" JSONB,
    "requestedBy" TEXT,
    "traceId" TEXT,
    "buildSha" TEXT,
    "heartbeatAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_job_rows" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "importJobId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawPayload" JSONB,
    "mappedPayload" JSONB,
    "validationStatus" "ImportRowValidationStatus" NOT NULL DEFAULT 'PENDING',
    "executionStatus" "ImportRowExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "executionClaimToken" INTEGER NOT NULL DEFAULT 0,
    "validationErrors" JSONB,
    "errorMessage" TEXT,
    "entityId" TEXT,
    "secondaryEntityIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "import_job_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(100) NOT NULL DEFAULT '',
    "company_id" VARCHAR(100) NOT NULL DEFAULT '',
    "consumer_key" VARCHAR(250) NOT NULL,
    "message_id" VARCHAR(500) NOT NULL,
    "event_name" VARCHAR(250) NOT NULL,
    "event_version" INTEGER NOT NULL DEFAULT 1,
    "message_type" VARCHAR(250) NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_hash" VARCHAR(128),
    "headers" JSONB,
    "status" "inbox_message_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "claim_token" UUID NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "correlation_id" VARCHAR(200),
    "causation_id" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributed_locks" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(100) NOT NULL,
    "company_id" VARCHAR(100) NOT NULL,
    "scope" VARCHAR(200) NOT NULL,
    "resource" VARCHAR(500) NOT NULL,
    "lock_key" VARCHAR(1000) NOT NULL,
    "fencing_token" BIGINT NOT NULL DEFAULT 0,
    "owner_token" UUID,
    "lease_until" TIMESTAMP(3),
    "acquired_at" TIMESTAMP(3),
    "renewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributed_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_requests" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "notificationType" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "sourceEvent" TEXT,
    "payload" JSONB,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "mode" "NotificationMode" NOT NULL DEFAULT 'ASYNC',
    "status" "NotificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "sentMessages" INTEGER NOT NULL DEFAULT 0,
    "failedMessages" INTEGER NOT NULL DEFAULT 0,
    "suppressedMessages" INTEGER NOT NULL DEFAULT 0,
    "requestedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_messages" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "notificationRequestId" UUID NOT NULL,
    "recipientRef" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "address" TEXT,
    "locale" TEXT,
    "templateId" UUID,
    "status" "NotificationMessageStatus" NOT NULL DEFAULT 'PENDING',
    "suppressReason" TEXT,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "renderedSnapshot" JSONB,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "notificationType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "bodyFormat" TEXT NOT NULL,
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "recipientRef" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "optedIn" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" TIME,
    "quietHoursEnd" TIME,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_suppressions" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "address" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT,
    "suppressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_messages" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(100),
    "company_id" VARCHAR(100),
    "message_id" VARCHAR(200) NOT NULL,
    "event_name" VARCHAR(250) NOT NULL,
    "event_version" INTEGER NOT NULL DEFAULT 1,
    "aggregate_type" VARCHAR(200) NOT NULL,
    "aggregate_id" VARCHAR(200) NOT NULL,
    "aggregate_version" INTEGER,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "status" "OutboxMessageStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claim_token" UUID,
    "claimed_at" TIMESTAMP(3),
    "available_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "last_error" TEXT,
    "correlation_id" VARCHAR(200),
    "causation_id" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_configs" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "companyCode" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "defaultCurrency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "autoApproveThreshold" DECIMAL(18,2) NOT NULL DEFAULT 10000,
    "overReceiptTolerance" DECIMAL(5,4) NOT NULL DEFAULT 0.1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "currentValue" BIGINT NOT NULL DEFAULT 0,
    "padding" INTEGER NOT NULL DEFAULT 0,
    "step" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "companyId" TEXT,
    "actorType" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "requestId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_configs" (
    "id" UUID NOT NULL,
    "company_code" TEXT NOT NULL,
    "item_group" TEXT,
    "supplier_group" TEXT,
    "policy_key" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_templates" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "templateNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecurringTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetEntityType" TEXT NOT NULL,
    "targetEntityId" UUID,
    "originDocumentType" TEXT,
    "originDocumentId" UUID,
    "partyId" UUID,
    "partyType" "RecurringPartyType",
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "triggerType" "RecurringTriggerType" NOT NULL,
    "eventName" TEXT,
    "frequency" "RecurringFrequency",
    "interval" INTEGER,
    "startDate" DATE,
    "endDate" DATE,
    "nextRunDate" DATE,
    "lastRunDate" DATE,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "autoPost" BOOLEAN NOT NULL DEFAULT false,
    "autoEmail" BOOLEAN NOT NULL DEFAULT false,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "headerOverrides" JSONB,
    "generationCondition" JSONB,
    "lines" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedBy" TEXT,
    "modifiedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "recurring_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_executions" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "recurringTemplateId" UUID NOT NULL,
    "scheduleJobId" UUID,
    "runDate" DATE,
    "sourceEventId" UUID,
    "triggerKey" TEXT NOT NULL,
    "generatedDocumentType" TEXT NOT NULL,
    "generatedDocumentId" UUID,
    "generatedSnapshot" JSONB,
    "conditionEvaluation" JSONB,
    "status" "RecurringExecutionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "skipReason" TEXT,
    "executionTimeMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saga_definitions" (
    "id" UUID NOT NULL,
    "owner_module" VARCHAR(200),
    "saga_key" VARCHAR(200) NOT NULL,
    "version" INTEGER NOT NULL,
    "event_name" VARCHAR(250) NOT NULL,
    "event_version" INTEGER NOT NULL,
    "status" "saga_definition_status" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "created_by" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saga_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saga_instances" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(100) NOT NULL,
    "company_id" VARCHAR(100) NOT NULL,
    "saga_key" VARCHAR(200) NOT NULL,
    "definition_id" UUID NOT NULL,
    "config_id" UUID,
    "root_ref_type" VARCHAR(200),
    "root_ref_id" VARCHAR(200),
    "correlation_id" VARCHAR(250) NOT NULL,
    "live_key" VARCHAR(500),
    "status" "saga_instance_state" NOT NULL DEFAULT 'RUNNING',
    "reason" "saga_instance_reason",
    "plan" JSONB NOT NULL,
    "context" JSONB NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "waiting_event" VARCHAR(250),
    "cancel_requested_at" TIMESTAMP(3),
    "last_error" TEXT,
    "deadline_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saga_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saga_steps" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(100) NOT NULL,
    "company_id" VARCHAR(100) NOT NULL,
    "instance_id" UUID NOT NULL,
    "step_id" VARCHAR(200) NOT NULL,
    "kind" "saga_step_kind" NOT NULL,
    "action" VARCHAR(250),
    "event_name" VARCHAR(250),
    "event_version" INTEGER,
    "status" "saga_step_state" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL,
    "locked_by" VARCHAR(200),
    "lock_until" TIMESTAMP(3),
    "input" JSONB,
    "output" JSONB,
    "last_error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saga_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saga_inbox" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(100) NOT NULL,
    "company_id" VARCHAR(100) NOT NULL,
    "consumer_key" VARCHAR(250) NOT NULL,
    "message_id" VARCHAR(500) NOT NULL,
    "event_name" VARCHAR(250) NOT NULL,
    "event_version" INTEGER NOT NULL,
    "correlation_id" VARCHAR(250),
    "instance_id" UUID,
    "payload" JSONB NOT NULL,
    "payload_hash" VARCHAR(128),
    "headers" JSONB,
    "status" "saga_inbox_state" NOT NULL DEFAULT 'RECEIVED',
    "reason" VARCHAR(250),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claim_token" UUID,
    "claimed_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,

    CONSTRAINT "saga_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saga_outbox" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(100),
    "company_id" VARCHAR(100),
    "message_id" VARCHAR(200) NOT NULL,
    "event_name" VARCHAR(250) NOT NULL,
    "event_version" INTEGER NOT NULL DEFAULT 1,
    "aggregate_type" VARCHAR(200) NOT NULL,
    "aggregate_id" VARCHAR(200) NOT NULL,
    "aggregate_version" INTEGER,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "status" "OutboxMessageStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claim_token" UUID,
    "claimed_at" TIMESTAMP(3),
    "available_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "last_error" TEXT,
    "correlation_id" VARCHAR(200),
    "causation_id" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saga_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "jobType" TEXT NOT NULL,
    "scope" "ScheduledJobScope" NOT NULL DEFAULT 'AGGREGATE',
    "scheduleMode" "ScheduledJobScheduleMode" NOT NULL DEFAULT 'EXTERNAL',
    "cronExpression" TEXT,
    "aggregateType" TEXT,
    "aggregateId" UUID,
    "payload" JSONB,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "status" "ScheduledJobStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_job_dispatch_log" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "scheduledJobId" UUID NOT NULL,
    "jobType" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "outcome" "ScheduledJobDispatchOutcome" NOT NULL,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "scheduled_job_dispatch_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_job_edit_log" (
    "id" UUID NOT NULL,
    "scheduledJobId" UUID NOT NULL,
    "editedBy" TEXT,
    "changedFields" JSONB NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_job_edit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "eventTypes" TEXT[],
    "status" "webhook_subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "tenantId" TEXT,
    "subscriptionId" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "webhook_delivery_status" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "lastResponseCode" INTEGER,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "tenantId" TEXT,
    "companyId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_lines" (
    "id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantity" INTEGER,
    "company_id" VARCHAR(100) NOT NULL,
    "tenant_id" VARCHAR(100) NOT NULL,

    CONSTRAINT "price_list_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_prices" (
    "id" UUID NOT NULL,
    "company_id" VARCHAR(100) NOT NULL,
    "tenant_id" VARCHAR(100) NOT NULL,
    "product_id" UUID NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "customer_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "good_receipt_notes" (
    "id" UUID NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "status" "GrnStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3),
    "posting_date" TIMESTAMP(3),
    "reversalOfId" UUID,
    "reversed_by_id" UUID,
    "reversal_reason" TEXT,
    "inspection_required" BOOLEAN NOT NULL DEFAULT false,
    "inspection_status" TEXT NOT NULL DEFAULT 'NOTREQUIRED',
    "inbound_message_id" TEXT,
    "idempotency_key" TEXT,
    "createdBy" TEXT,
    "receivedBy" TEXT,
    "postedBy" TEXT,
    "cancelledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tenantId" TEXT,
    "companyId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',

    CONSTRAINT "good_receipt_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grn_lines" (
    "id" UUID NOT NULL,
    "grnId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "orderedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL,
    "acceptedQuantity" INTEGER NOT NULL DEFAULT 0,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "stock_category" TEXT NOT NULL DEFAULT 'UNRESTRICTED',
    "variance_flag" BOOLEAN NOT NULL DEFAULT false,
    "variance_type" TEXT,
    "batch_no" TEXT,
    "serial_no" TEXT,
    "expiry_date" TIMESTAMP(3),

    CONSTRAINT "grn_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "externalReference" VARCHAR(128),
    "vendorId" UUID NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "orderDate" TIMESTAMP(3),
    "expectedDeliveryDate" TIMESTAMP(3),
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "issuedBy" TEXT,
    "cancelledBy" TEXT,
    "amendedBy" TEXT,
    "amendedAt" TIMESTAMP(3),
    "amendmentReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tenantId" TEXT,
    "companyId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "descriptionSnapshot" TEXT,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tenantId" TEXT,
    "companyId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lines" JSONB NOT NULL,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tenantId" TEXT,
    "companyId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendors_tenantId_idx" ON "vendors"("tenantId");

-- CreateIndex
CREATE INDEX "vendors_companyId_idx" ON "vendors"("companyId");

-- CreateIndex
CREATE INDEX "vendors_status_idx" ON "vendors"("status");

-- CreateIndex
CREATE INDEX "vendors_createdAt_idx" ON "vendors"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_companyId_code_key" ON "vendors"("companyId", "code");

-- CreateIndex
CREATE INDEX "approval_records_doc_id_idx" ON "approval_records"("doc_id");

-- CreateIndex
CREATE INDEX "batch_operation_jobs_tenantId_status_idx" ON "batch_operation_jobs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "batch_operation_jobs_aggregateType_idx" ON "batch_operation_jobs"("aggregateType");

-- CreateIndex
CREATE UNIQUE INDEX "batch_operation_jobs_tenantId_jobNo_key" ON "batch_operation_jobs"("tenantId", "jobNo");

-- CreateIndex
CREATE INDEX "batch_operation_job_rows_batchOperationJobId_status_idx" ON "batch_operation_job_rows"("batchOperationJobId", "status");

-- CreateIndex
CREATE INDEX "batch_operation_job_rows_tenantId_status_createdAt_idx" ON "batch_operation_job_rows"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "batch_operation_job_rows_batchOperationJobId_entityId_key" ON "batch_operation_job_rows"("batchOperationJobId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "document_number_sequences_company_code_fiscal_year_doc_type_key" ON "document_number_sequences"("company_code", "fiscal_year", "doc_type");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_status_lease_until_idx" ON "idempotency_keys"("status", "lease_until");

-- CreateIndex
CREATE INDEX "idempotency_keys_tenant_id_company_id_idx" ON "idempotency_keys"("tenant_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_tenant_id_company_id_scope_idempotency_key_key" ON "idempotency_keys"("tenant_id", "company_id", "scope", "idempotency_key");

-- CreateIndex
CREATE INDEX "storage_objects_tenantId_purpose_createdAt_idx" ON "storage_objects"("tenantId", "purpose", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "storage_objects_scanStatus_createdAt_idx" ON "storage_objects"("scanStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "storage_objects_storageKey_key" ON "storage_objects"("storageKey");

-- CreateIndex
CREATE INDEX "import_jobs_tenantId_status_idx" ON "import_jobs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "import_jobs_entityKey_idx" ON "import_jobs"("entityKey");

-- CreateIndex
CREATE INDEX "import_jobs_status_heartbeatAt_idx" ON "import_jobs"("status", "heartbeatAt");

-- CreateIndex
CREATE UNIQUE INDEX "import_jobs_tenantId_jobNo_key" ON "import_jobs"("tenantId", "jobNo");

-- CreateIndex
CREATE INDEX "import_job_rows_importJobId_validationStatus_idx" ON "import_job_rows"("importJobId", "validationStatus");

-- CreateIndex
CREATE INDEX "import_job_rows_importJobId_executionStatus_idx" ON "import_job_rows"("importJobId", "executionStatus");

-- CreateIndex
CREATE INDEX "import_job_rows_tenantId_createdAt_idx" ON "import_job_rows"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "import_job_rows_importJobId_rowNumber_key" ON "import_job_rows"("importJobId", "rowNumber");

-- CreateIndex
CREATE INDEX "inbox_messages_status_next_attempt_at_idx" ON "inbox_messages"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_messages_tenant_id_company_id_consumer_key_message_id_key" ON "inbox_messages"("tenant_id", "company_id", "consumer_key", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "distributed_locks_lock_key_key" ON "distributed_locks"("lock_key");

-- CreateIndex
CREATE INDEX "distributed_locks_lease_until_idx" ON "distributed_locks"("lease_until");

-- CreateIndex
CREATE UNIQUE INDEX "distributed_locks_tenant_id_company_id_scope_resource_key" ON "distributed_locks"("tenant_id", "company_id", "scope", "resource");

-- CreateIndex
CREATE INDEX "notification_requests_tenantId_status_idx" ON "notification_requests"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_requests_tenantId_dedupKey_key" ON "notification_requests"("tenantId", "dedupKey");

-- CreateIndex
CREATE INDEX "notification_messages_notificationRequestId_status_idx" ON "notification_messages"("notificationRequestId", "status");

-- CreateIndex
CREATE INDEX "notification_messages_providerMessageId_idx" ON "notification_messages"("providerMessageId");

-- CreateIndex
CREATE INDEX "notification_messages_tenantId_status_createdAt_idx" ON "notification_messages"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_messages_notificationRequestId_recipientRef_ch_key" ON "notification_messages"("notificationRequestId", "recipientRef", "channel");

-- CreateIndex
CREATE INDEX "notification_templates_tenantId_notificationType_channel_idx" ON "notification_templates"("tenantId", "notificationType", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_tenantId_notificationType_channel_lo_key" ON "notification_templates"("tenantId", "notificationType", "channel", "locale", "version");

-- CreateIndex
CREATE INDEX "notification_preferences_tenantId_recipientRef_idx" ON "notification_preferences"("tenantId", "recipientRef");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_tenantId_recipientRef_category_cha_key" ON "notification_preferences"("tenantId", "recipientRef", "category", "channel");

-- CreateIndex
CREATE INDEX "notification_suppressions_tenantId_address_channel_idx" ON "notification_suppressions"("tenantId", "address", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_suppressions_tenantId_address_channel_key" ON "notification_suppressions"("tenantId", "address", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_messages_message_id_key" ON "outbox_messages"("message_id");

-- CreateIndex
CREATE INDEX "outbox_messages_status_available_at_idx" ON "outbox_messages"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_messages_tenant_id_company_id_status_idx" ON "outbox_messages"("tenant_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "outbox_messages_claimed_at_idx" ON "outbox_messages"("claimed_at");

-- CreateIndex
CREATE INDEX "outbox_messages_aggregate_type_aggregate_id_idx" ON "outbox_messages"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_configs_companyId_key" ON "company_configs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_configs_companyCode_key" ON "company_configs"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_key_key" ON "number_sequences"("key");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "policy_configs_company_code_policy_key_idx" ON "policy_configs"("company_code", "policy_key");

-- CreateIndex
CREATE INDEX "recurring_templates_tenantId_status_idx" ON "recurring_templates"("tenantId", "status");

-- CreateIndex
CREATE INDEX "recurring_templates_tenantId_eventName_status_idx" ON "recurring_templates"("tenantId", "eventName", "status");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_templates_tenantId_templateNo_key" ON "recurring_templates"("tenantId", "templateNo");

-- CreateIndex
CREATE INDEX "recurring_executions_recurringTemplateId_createdAt_idx" ON "recurring_executions"("recurringTemplateId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "recurring_executions_tenantId_status_createdAt_idx" ON "recurring_executions"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "recurring_executions_recurringTemplateId_triggerKey_key" ON "recurring_executions"("recurringTemplateId", "triggerKey");

-- CreateIndex
CREATE INDEX "saga_definitions_event_name_event_version_status_idx" ON "saga_definitions"("event_name", "event_version", "status");

-- CreateIndex
CREATE UNIQUE INDEX "saga_definitions_saga_key_version_key" ON "saga_definitions"("saga_key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "saga_instances_live_key_key" ON "saga_instances"("live_key");

-- CreateIndex
CREATE INDEX "saga_instances_tenant_id_company_id_status_idx" ON "saga_instances"("tenant_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "saga_instances_tenant_id_company_id_saga_key_status_idx" ON "saga_instances"("tenant_id", "company_id", "saga_key", "status");

-- CreateIndex
CREATE INDEX "saga_instances_saga_key_correlation_id_idx" ON "saga_instances"("saga_key", "correlation_id");

-- CreateIndex
CREATE INDEX "saga_steps_status_run_at_idx" ON "saga_steps"("status", "run_at");

-- CreateIndex
CREATE INDEX "saga_steps_company_id_status_idx" ON "saga_steps"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "saga_steps_instance_id_step_id_kind_key" ON "saga_steps"("instance_id", "step_id", "kind");

-- CreateIndex
CREATE INDEX "saga_inbox_instance_id_status_idx" ON "saga_inbox"("instance_id", "status");

-- CreateIndex
CREATE INDEX "saga_inbox_status_next_attempt_at_idx" ON "saga_inbox"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "saga_inbox_tenant_id_company_id_consumer_key_message_id_key" ON "saga_inbox"("tenant_id", "company_id", "consumer_key", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "saga_outbox_message_id_key" ON "saga_outbox"("message_id");

-- CreateIndex
CREATE INDEX "saga_outbox_status_available_at_idx" ON "saga_outbox"("status", "available_at");

-- CreateIndex
CREATE INDEX "saga_outbox_tenant_id_company_id_status_idx" ON "saga_outbox"("tenant_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "saga_outbox_claimed_at_idx" ON "saga_outbox"("claimed_at");

-- CreateIndex
CREATE INDEX "saga_outbox_aggregate_type_aggregate_id_idx" ON "saga_outbox"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "scheduled_jobs_jobType_status_idx" ON "scheduled_jobs"("jobType", "status");

-- CreateIndex
CREATE INDEX "scheduled_jobs_status_nextRunAt_idx" ON "scheduled_jobs"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "scheduled_jobs_lockedUntil_idx" ON "scheduled_jobs"("lockedUntil");

-- CreateIndex
CREATE INDEX "scheduled_jobs_aggregateType_aggregateId_idx" ON "scheduled_jobs"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "scheduled_jobs_tenantId_idx" ON "scheduled_jobs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_job_dispatch_log_idempotencyKey_key" ON "scheduled_job_dispatch_log"("idempotencyKey");

-- CreateIndex
CREATE INDEX "scheduled_job_dispatch_log_scheduledJobId_dispatchedAt_idx" ON "scheduled_job_dispatch_log"("scheduledJobId", "dispatchedAt" DESC);

-- CreateIndex
CREATE INDEX "scheduled_job_dispatch_log_jobType_outcome_dispatchedAt_idx" ON "scheduled_job_dispatch_log"("jobType", "outcome", "dispatchedAt" DESC);

-- CreateIndex
CREATE INDEX "scheduled_job_edit_log_scheduledJobId_editedAt_idx" ON "scheduled_job_edit_log"("scheduledJobId", "editedAt" DESC);

-- CreateIndex
CREATE INDEX "webhook_subscriptions_tenantId_status_idx" ON "webhook_subscriptions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_nextAttemptAt_idx" ON "webhook_deliveries"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "webhook_deliveries_tenantId_status_createdAt_idx" ON "webhook_deliveries"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_deliveries_subscriptionId_eventId_key" ON "webhook_deliveries"("subscriptionId", "eventId");

-- CreateIndex
CREATE INDEX "price_lists_tenantId_idx" ON "price_lists"("tenantId");

-- CreateIndex
CREATE INDEX "price_lists_companyId_idx" ON "price_lists"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_companyId_code_key" ON "price_lists"("companyId", "code");

-- CreateIndex
CREATE INDEX "price_list_lines_price_list_id_idx" ON "price_list_lines"("price_list_id");

-- CreateIndex
CREATE INDEX "price_list_lines_product_id_idx" ON "price_list_lines"("product_id");

-- CreateIndex
CREATE INDEX "price_list_lines_company_id_idx" ON "price_list_lines"("company_id");

-- CreateIndex
CREATE INDEX "price_list_lines_tenant_id_idx" ON "price_list_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "customer_prices_product_id_idx" ON "customer_prices"("product_id");

-- CreateIndex
CREATE INDEX "customer_prices_company_id_idx" ON "customer_prices"("company_id");

-- CreateIndex
CREATE INDEX "customer_prices_tenant_id_idx" ON "customer_prices"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_prices_product_id_company_id_tenant_id_key" ON "customer_prices"("product_id", "company_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "good_receipt_notes_inbound_message_id_key" ON "good_receipt_notes"("inbound_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "good_receipt_notes_idempotency_key_key" ON "good_receipt_notes"("idempotency_key");

-- CreateIndex
CREATE INDEX "good_receipt_notes_tenantId_idx" ON "good_receipt_notes"("tenantId");

-- CreateIndex
CREATE INDEX "good_receipt_notes_companyId_idx" ON "good_receipt_notes"("companyId");

-- CreateIndex
CREATE INDEX "good_receipt_notes_reversalOfId_idx" ON "good_receipt_notes"("reversalOfId");

-- CreateIndex
CREATE INDEX "good_receipt_notes_purchaseOrderId_idx" ON "good_receipt_notes"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "good_receipt_notes_vendorId_idx" ON "good_receipt_notes"("vendorId");

-- CreateIndex
CREATE INDEX "good_receipt_notes_status_idx" ON "good_receipt_notes"("status");

-- CreateIndex
CREATE INDEX "good_receipt_notes_createdAt_idx" ON "good_receipt_notes"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "good_receipt_notes_companyId_grnNumber_key" ON "good_receipt_notes"("companyId", "grnNumber");

-- CreateIndex
CREATE INDEX "grn_lines_productId_idx" ON "grn_lines"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "grn_lines_grnId_productId_key" ON "grn_lines"("grnId", "productId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_idx" ON "purchase_orders"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_orders_companyId_idx" ON "purchase_orders"("companyId");

-- CreateIndex
CREATE INDEX "purchase_orders_vendorId_idx" ON "purchase_orders"("vendorId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_createdAt_idx" ON "purchase_orders"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_companyId_orderNumber_key" ON "purchase_orders"("companyId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_companyId_externalReference_key" ON "purchase_orders"("companyId", "externalReference");

-- CreateIndex
CREATE INDEX "purchase_order_lines_productId_idx" ON "purchase_order_lines"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_lines_purchaseOrderId_productId_key" ON "purchase_order_lines"("purchaseOrderId", "productId");

-- CreateIndex
CREATE INDEX "products_tenantId_idx" ON "products"("tenantId");

-- CreateIndex
CREATE INDEX "products_companyId_idx" ON "products"("companyId");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_createdAt_idx" ON "products"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_companyId_sku_key" ON "products"("companyId", "sku");

-- CreateIndex
CREATE INDEX "invoices_tenantId_idx" ON "invoices"("tenantId");

-- CreateIndex
CREATE INDEX "invoices_companyId_idx" ON "invoices"("companyId");

-- CreateIndex
CREATE INDEX "invoices_customerId_status_idx" ON "invoices"("customerId", "status");

-- CreateIndex
CREATE INDEX "invoices_status_createdAt_idx" ON "invoices"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_companyId_invoiceNo_key" ON "invoices"("companyId", "invoiceNo");

-- AddForeignKey
ALTER TABLE "batch_operation_job_rows" ADD CONSTRAINT "batch_operation_job_rows_batchOperationJobId_fkey" FOREIGN KEY ("batchOperationJobId") REFERENCES "batch_operation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_sourceStorageObjectId_fkey" FOREIGN KEY ("sourceStorageObjectId") REFERENCES "storage_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_errorReportStorageObjectId_fkey" FOREIGN KEY ("errorReportStorageObjectId") REFERENCES "storage_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_notificationRequestId_fkey" FOREIGN KEY ("notificationRequestId") REFERENCES "notification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_executions" ADD CONSTRAINT "recurring_executions_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "recurring_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_executions" ADD CONSTRAINT "recurring_executions_scheduleJobId_fkey" FOREIGN KEY ("scheduleJobId") REFERENCES "scheduled_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_job_dispatch_log" ADD CONSTRAINT "scheduled_job_dispatch_log_scheduledJobId_fkey" FOREIGN KEY ("scheduledJobId") REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_job_edit_log" ADD CONSTRAINT "scheduled_job_edit_log_scheduledJobId_fkey" FOREIGN KEY ("scheduledJobId") REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "good_receipt_notes" ADD CONSTRAINT "good_receipt_notes_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "good_receipt_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "good_receipt_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
