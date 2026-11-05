# Excel Sheet Specification — Purchase Module

This document specifies the structure of the Excel spreadsheet (`docs/FolderStructure.xlsx` or a
dedicated purchase-module sheet) for the PurchaseOrder and GoodReceiptNote aggregates. Use this
as the source of truth when updating or creating the Excel documentation.

## Sheet 1: Module Overview

| Field | Value |
|-------|-------|
| Module name | purchase-order |
| Context | procurement |
| Aggregate root | PurchaseOrder |
| Natural key | orderNumber (unique per company) |
| Status machine | DRAFT → SUBMITTED → APPROVED → ISSUED → COMPLETED |
| Alternative statuses | REJECTED (from SUBMITTED), CANCELLED (from DRAFT/SUBMITTED/APPROVED) |
| Owner entity | PurchaseOrderLine[] (child lines) |
| References | Vendor (by id), Product (by id on lines) |
| Public port | PurchaseOrderForGrnPort (consumed by GRN module) |
| Outbound ports consumed | PurchasableProductPort, OrderableVendorPort |
| Numbering sequence | `purchase-order.number`, prefix `PO-`, padding 8 |
| Tenancy | tenantId + companyId stamped on create, filtered on read/write |
| Optimistic concurrency | Yes (version field) |

## Sheet 2: Database Tables

### purchase_orders

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| orderNumber | String | NO | `PO-00000001` style, unique per company |
| vendorId | UUID | NO | References vendors.id |
| currency | String | NO | ISO currency code |
| status | String | NO | DRAFT/SUBMITTED/APPROVED/ISSUED/COMPLETED/REJECTED/CANCELLED |
| orderDate | DateTime | NO | |
| expectedDeliveryDate | DateTime | YES | |
| createdBy | String | YES | actorId / userId |
| totalAmount | Decimal | NO | Computed subtotal |
| tenantId | String | YES | Tenancy scope |
| companyId | String | NO | Company scope |
| version | Int | NO | Optimistic concurrency |
| createdAt | DateTime | NO | |
| updatedAt | DateTime | NO | |

### purchase_order_lines

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| purchaseOrderId | UUID | NO | References purchase_orders.id |
| productId | UUID | NO | References products.id |
| quantity | Decimal | NO | Ordered quantity |
| unitPrice | Decimal | NO | Snapshot at order time |
| receivedQuantity | Decimal | NO | Accumulated received qty |
| createdAt | DateTime | NO | |
| updatedAt | DateTime | NO | |

### good_receipt_notes (related)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| grnNumber | String | NO | `GRN-00000001` style |
| purchaseOrderId | UUID | NO | References purchase_orders.id |
| vendorId | UUID | NO | Must match PO vendor |
| status | String | NO | DRAFT/RECEIVED/COMPLETED/CANCELLED |
| currency | String | NO | |
| tenantId | String | YES | |
| companyId | String | NO | |
| version | Int | NO | |
| createdAt | DateTime | NO | |
| updatedAt | DateTime | NO | |

### grn_lines (related)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| grnId | UUID | NO | References good_receipt_notes.id |
| productId | UUID | NO | |
| orderedQuantity | Decimal | NO | Snapshot from PO line |
| receivedQuantity | Decimal | NO | |
| unitPrice | Decimal | NO | Snapshot from PO line |
| createdAt | DateTime | NO | |

## Sheet 3: Domain Events

| Event | Raised by | Payload key | Outbox routing |
|-------|-----------|-------------|----------------|
| PurchaseOrderCreated | create use case | purchaseOrder | rabbitmq |
| PurchaseOrderSubmitted | submit transition | purchaseOrder | rabbitmq |
| PurchaseOrderApproved | approve transition | purchaseOrder | rabbitmq |
| PurchaseOrderRejected | reject transition | purchaseOrder | rabbitmq |
| PurchaseOrderIssued | issue transition | purchaseOrder | rabbitmq |
| PurchaseOrderCancelled | cancel transition | purchaseOrder | rabbitmq |
| PurchaseOrderCompleted | close transition | purchaseOrder | rabbitmq |
| PurchaseOrderAmended | amend transition | purchaseOrder | rabbitmq |
| LineAdded | addLine | purchaseOrderLine | rabbitmq |
| LineRemoved | removeLine | purchaseOrderLine | rabbitmq |
| GoodsReceiptPosted | post GRN | grn | rabbitmq |
| GoodsReceiptReversed | reverse GRN | grn | rabbitmq |

## Sheet 4: Use Cases

| Use case | File | Transactional | ABAC resource | ABAC action |
|----------|------|---------------|---------------|-------------|
| CreatePurchaseOrder | create-purchase-order.usecase.ts | Yes | PurchaseOrder | create |
| AddPurchaseOrderLine | add-purchase-order-line.usecase.ts | Yes | PurchaseOrder | update |
| UpdatePurchaseOrderLine | update-purchase-order-line.usecase.ts | Yes | PurchaseOrder | update |
| RemovePurchaseOrderLine | remove-purchase-order-line.usecase.ts | Yes | PurchaseOrder | update |
| PurchaseOrderTransition | purchase-order-transition.usecase.ts | Yes | PurchaseOrder | submit/approve/reject/cancel/complete |
| AmendPurchaseOrder | amend-purchase-order.usecase.ts | Yes | PurchaseOrder | update |
| RegisterPurchaseOrderReceipt | register-purchase-order-receipt.usecase.ts | Yes | PurchaseOrder | receive |
| ImportPurchaseOrder | import-purchase-order.usecase.ts | Yes | PurchaseOrder | import |
| GenerateRecurringPurchaseOrder | generate-recurring-purchase-order.usecase.ts | Yes | PurchaseOrder | create |

## Sheet 5: API Endpoints

| Method | Path | Controller method | Use case | Auth guard | ABAC |
|--------|------|-------------------|----------|------------|------|
| POST | /api/v1/purchase-orders | create | CreatePurchaseOrderUseCase | RbacGuard + TenancyAuthGuard | Yes |
| GET | /api/v1/purchase-orders | list | ListPurchaseOrdersUseCase | TenancyAuthGuard | Yes |
| GET | /api/v1/purchase-orders/:id | get | GetPurchaseOrderUseCase | TenancyAuthGuard | Yes |
| POST | /api/v1/purchase-orders/:id/lines | addLine | AddPurchaseOrderLineUseCase | RbacGuard | Yes |
| PATCH | /api/v1/purchase-orders/:id/lines/:productId | updateLine | UpdatePurchaseOrderLineUseCase | RbacGuard | Yes |
| DELETE | /api/v1/purchase-orders/:id/lines/:productId | removeLine | RemovePurchaseOrderLineUseCase | RbacGuard | Yes |
| POST | /api/v1/purchase-orders/:id/submit | submit | PurchaseOrderTransitionUseCase | RbacGuard | Yes |
| POST | /api/v1/purchase-orders/:id/approve | approve | PurchaseOrderTransitionUseCase | RbacGuard | Yes |
| POST | /api/v1/purchase-orders/:id/reject | reject | PurchaseOrderTransitionUseCase | RbacGuard | Yes |
| POST | /api/v1/purchase-orders/:id/cancel | cancel | PurchaseOrderTransitionUseCase | RbacGuard | Yes |
| POST | /api/v1/purchase-orders/:id/issue | issue | IssuePurchaseOrderUseCase | RbacGuard | Yes |
| POST | /api/v1/purchase-orders/:id/close | close | ClosePurchaseOrderUseCase | RbacGuard | Yes |
| POST | /api/v1/purchase-orders/:id/receive | receive | RegisterPurchaseOrderReceiptUseCase | RbacGuard | Yes |

## Sheet 6: Cross-Module Contracts

| Consumer | Provider | Port | Facade |
|----------|----------|------|--------|
| PurchaseOrder | Product | PurchasableProductPort | ProductForPurchaseFacade |
| PurchaseOrder | Vendor | OrderableVendorPort | VendorForPurchaseFacade |
| GoodReceiptNote | PurchaseOrder | PurchaseOrderPort | PurchaseOrderForGrnFacade |

## Sheet 7: Invariants & Policies

| Key | Type | Enforced by | Rule |
|-----|------|-------------|------|
| purchase-order.editable | invariant | domain | Editable only in DRAFT status |
| purchase-order.min-lines | invariant | domain | ≥1 line before submit |
| purchase-order.positive-quantity | invariant | domain | Quantity > 0 |
| purchase-order.valid-transition | invariant | domain | Legal status transitions only |
| purchase-order.can-approve | policy | policyRegistry | `total <= autoApproveThreshold` → auto-approve |
| grn.status-transition | invariant | domain | Legal GRN status transitions |
| grn.reversible | invariant | domain | Only COMPLETED GRN can be reversed |

## Sheet 8: Verification Checks

| Check | Command | Expected |
|-------|---------|----------|
| TypeScript | `npx tsc --noEmit -p tsconfig.json` | No errors |
| Lint | `npm run lint:check` | Pass (except pre-existing cache warnings) |
| Format | `npm run format:check` | Pass |
| DI docs | `npm run docs:di` | Regenerates docs/DI-WIRING.md |
| Build | `npm run build` | Compiles to dist/ |
| DI smoke | NODE_ENV=test node -e "..." | App initializes without errors |

## Sheet 9: Open Work / Deferred

| Item | Status | Notes |
|------|--------|-------|
| IAM / Auth | Deferred | RBAC/ABAC ports exist with no-op adapters |
| Real AuthenticationPort | Not implemented | Returns null via no-op adapter |
| Real RbacPort | Not implemented | Returns true via no-op adapter |
| Real AbacPort | Not implemented | Returns ALLOW via no-op adapter |
| Optimistic concurrency on Vendor/Product/Invoice | Not implemented | Last-write-wins |
