-- CreateEnum
CREATE TYPE "BatchOperationMode" AS ENUM ('SYNC', 'ASYNC');

-- CreateEnum
CREATE TYPE "BatchOperationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchOperationRowStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'SKIPPED');

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
CREATE TYPE "ScheduledJobStatus" AS ENUM ('PENDING', 'CLAIMED', 'RUNNING', 'FAILED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduledJobScope" AS ENUM ('AGGREGATE', 'TENANT', 'PLATFORM');

-- CreateEnum
CREATE TYPE "ScheduledJobScheduleMode" AS ENUM ('CRON', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ScheduledJobDispatchOutcome" AS ENUM ('SUCCESS', 'FAILED', 'DEAD_LETTERED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

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
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "recurring_templates_templateNo_key" ON "recurring_templates"("templateNo");

-- CreateIndex
CREATE INDEX "recurring_templates_tenantId_status_idx" ON "recurring_templates"("tenantId", "status");

-- CreateIndex
CREATE INDEX "recurring_templates_tenantId_eventName_status_idx" ON "recurring_templates"("tenantId", "eventName", "status");

-- CreateIndex
CREATE INDEX "recurring_executions_recurringTemplateId_createdAt_idx" ON "recurring_executions"("recurringTemplateId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "recurring_executions_tenantId_status_createdAt_idx" ON "recurring_executions"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "recurring_executions_recurringTemplateId_triggerKey_key" ON "recurring_executions"("recurringTemplateId", "triggerKey");

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
CREATE UNIQUE INDEX "invoices_invoiceNo_key" ON "invoices"("invoiceNo");

-- CreateIndex
CREATE INDEX "invoices_customerId_status_idx" ON "invoices"("customerId", "status");

-- CreateIndex
CREATE INDEX "invoices_status_createdAt_idx" ON "invoices"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "batch_operation_job_rows" ADD CONSTRAINT "batch_operation_job_rows_batchOperationJobId_fkey" FOREIGN KEY ("batchOperationJobId") REFERENCES "batch_operation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_sourceStorageObjectId_fkey" FOREIGN KEY ("sourceStorageObjectId") REFERENCES "storage_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_errorReportStorageObjectId_fkey" FOREIGN KEY ("errorReportStorageObjectId") REFERENCES "storage_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_executions" ADD CONSTRAINT "recurring_executions_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "recurring_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_executions" ADD CONSTRAINT "recurring_executions_scheduleJobId_fkey" FOREIGN KEY ("scheduleJobId") REFERENCES "scheduled_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_job_dispatch_log" ADD CONSTRAINT "scheduled_job_dispatch_log_scheduledJobId_fkey" FOREIGN KEY ("scheduledJobId") REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_job_edit_log" ADD CONSTRAINT "scheduled_job_edit_log_scheduledJobId_fkey" FOREIGN KEY ("scheduledJobId") REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
