# ERP Boilerplate — Data Model

This document describes the Prisma schema, database tables, tenancy model, and natural keys.

## Schema organization

The Prisma schema is split per bounded context under `prisma/schema/<context>/` and
aggregated by `prisma/schema/schema.prisma`:

| Context | Schema file | Tables |
|---------|-------------|--------|
| `platform` | `platform.prisma` + `*.prisma` | outbox_messages, inbox_messages, saga_steps, scheduled_jobs, batch_operation_*, import_job*, notification_*, number_sequences, company_configs, audit_logs, idempotency_keys, lock_leases, webhook_*, recurring_*, scheduler_*, policy_configs, approval_records, accounting_entries |
| `party` | `party/vendor.prisma` | vendors |
| `procurement` | `procurement/product.prisma` | products |
| `procurement` | `procurement/purchase-order.prisma` | purchase_orders, purchase_order_lines |
| `procurement` | `procurement/good-receipt-note.prisma` | good_receipt_notes, grn_lines |
| `sales` | `sales/invoice.prisma` | invoices, invoice_lines |
| `inventory` | `inventory/stock-movement.prisma` | stock_movements |

## No migrations

**There are no Prisma migrations.** The database is created/synced straight from the
schema:

```bash
npm run db:push   # create/sync database from prisma/schema
npx prisma generate  # regenerate client into src/generated/
```

Change the schema, then re-run `npm run db:push`. Introduce a versioned migration folder
only when a released schema needs a forward-only rollout.

## Tenancy model

Every business table carries `tenantId`/`companyId`:

| Rule | Detail |
|------|--------|
| Stamped on create | `tenantId`/`companyId` stamped from the request context |
| Filtered on read/write | Every business repository filters on `tenantId`/`companyId` |
| Foreign row = 404 | A row owned by another tenant is not found — never 403 (no existence leak) |
| Natural key unique per company | Order number, GRN number, SKU, vendor code, invoice number unique within company |
| Numbering series company-scoped | Two companies each have a `PO-00000001` |

### Owned documents (strict tenancy)

`purchase_orders`, `good_receipt_notes`, `invoices` — a tenant-scoped request sees only
its own rows. An unscoped legacy row is invisible (fail-closed).

### Shared master data (nullable tenancy)

`products`, `vendors` — a tenant-scoped request sees its own rows **plus** rows that were
never tenant-scoped (`NULL` = shared catalogue).

## Physical column names

Platform tables are **not uniform**:

| snake_case tables | camelCase tables |
|-------------------|------------------|
| `outbox_messages` | `scheduled_jobs` |
| `inbox_messages` | `batch_operation_*` |
| `saga_steps` | `import_job*` |
| | `notification_*` |

Hand-written `$queryRaw` must use the **physical column names**. A wrong column name fails
the statement on every call, silently. `RETURNING` lists alias physical names back to
camelCase so TypeScript mappers keep working.

## Seed data

`prisma/seed.ts` seeds sample products and vendors:

```bash
npm run db:seed
```
