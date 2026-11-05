# Data Model — Implemented

Prisma schemas live under `prisma/schema/<context>/*.prisma`. There are no
migrations; sync with `npm run db:push` and regenerate client with
`npx prisma generate`.

## Schema files

- `prisma/schema/schema.prisma` (root)
- `prisma/schema/party/vendor.prisma`
- `prisma/schema/procurement/product.prisma`
- `prisma/schema/procurement/purchase-order.prisma`
- `prisma/schema/procurement/good-receipt-note.prisma`
- `prisma/schema/sales/invoice.prisma`
- `prisma/schema/inventory/stock-movement.prisma`
- `prisma/schema/platform/*.prisma` (accounting-entry, approval-record,
  batch-operation, document-number-sequence, idempotency, import, inbox,
  notification, outbox, platform, policy-config, recurring, saga, scheduler,
  webhook)

## Models (tables)

AccountingEntry, ApprovalRecord, AuditLog, BatchOperationJob,
BatchOperationJobRow, CompanyConfig, DocumentNumberSequence, GoodReceiptNote,
GrnLine, IdempotencyKey, ImportJob, ImportJobRow, InboxMessage, Invoice,
NotificationMessage, NotificationPreference, NotificationRequest,
NotificationSuppression, NotificationTemplate, NumberSequence, OutboxMessage,
PolicyConfig, Product, PurchaseOrder, PurchaseOrderLine, RecurringExecution,
RecurringTemplate, SagaCompanyConfig, SagaDefinition, SagaInbox, SagaInstance,
SagaStep, ScheduledJob, ScheduledJobDispatchLog, ScheduledJobEditLog,
StockBalance, StockMovement, StorageObject, Vendor, WebhookDelivery,
WebhookSubscription.

## Tenancy

Business tables (`purchase_orders`, `good_receipt_notes`, `products`,
`vendors`, `invoices`) carry `tenantId`/`companyId`. Owned documents are
strict (`tenantId = request`); master data also includes unscoped (shared)
rows. Foreign row ⇒ 404.

## Concurrency

Optimistic concurrency (`version`) implemented on PurchaseOrder and GRN only.
Vendor, Product, Invoice command repositories are last-write-wins.
