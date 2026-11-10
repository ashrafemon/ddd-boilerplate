# Purchase Order Module — File Specification (Why / What / Who / Whom / Adapter)

See [`docs/Erp Backend Folder Structure.xlsx`](docs/Erp Backend Folder Structure.xlsx) for the complete project structure and detailed file organization reference, including the **Use Case & Facade Architecture** sheet.

This document specifies every file in `src/business/procurement/purchase-order/`, organized by layer.
For each file: **Why** (purpose), **What** (contents), **Who** (consumers), **Whom** (interacts with),
**Adapter** (implementing adapter if it is a port).

---

## Domain Layer

### `domain/aggregates/purchase-order.aggregate.ts`

| Field | Detail |
|-------|--------|
| **Why** | Aggregate root — sole mutation path for PurchaseOrder; enforces invariants and raises domain events |
| **What** | `PurchaseOrder` class extending `AggregateRoot<PurchaseOrderId>`; methods: `updateHeader`, `addLine`, `setLine`, `removeLine`, `submit`, `approve`, `reject`, `cancel`, `amend`, `issue`, `close`; computed `subtotal`/`total` |
| **Who** | Command use cases (create, add/remove/update line, transition, amend, issue, close, receive) |
| **Whom** | `PurchaseOrderFactory`, `PurchaseOrderInvariants`, `PurchaseOrderPolicy`, domain events, `PurchaseOrderPricingService` |
| **Adapter** | N/A (pure domain) |

### `domain/aggregates/purchase-order.invariants.ts`

| Field | Detail |
|-------|--------|
| **Why** | Enforce purchase-order invariants via class-based static methods |
| **What** | `PurchaseOrderInvariants` class with static methods: `enforcePurchaseOrderLineQuantity`, `enforcePurchaseOrderAmendable`, `enforcePurchaseOrderCreate`, `enforcePurchaseOrderHasLines`, `enforcePurchaseOrderStatusTransition`, `enforcePurchaseOrderEditable`, `enforcePurchaseOrderCancellation`, `enforceRecurringPoLinesCreate`, `enforceRecurringPoLineProductId`, `enforceRecurringPoLineQuantity`, `enforceRecurringPoLineUnitPrice` |
| **Who** | Command use cases and aggregate methods call `PurchaseOrderInvariants.enforce*()` statically |
| **Whom** | `PurchaseOrder` aggregate, `PurchaseOrderFactory`, recurring line service |
| **Adapter** | N/A |

### `domain/entities/purchase-order-line.entity.ts`

| Field | Detail |
|-------|--------|
| **Why** | Child entity of PurchaseOrder — represents a single line item |
| **What** | `PurchaseOrderLine` class with `productId`, `quantity`, `unitPrice`, `total`, `receivedQuantity`, `description`; methods `withUpdatedQuantity`, `withAmendedUnitPrice` |
| **Who** | `PurchaseOrder` aggregate (`addLine`, `setLine`, `removeLine`, `amend`) |
| **Whom** | `PurchaseOrderLine` invariants, `PurchaseOrderPricingService` |
| **Adapter** | N/A |

### `domain/entities/purchase-order-line.entity.invariants.ts`

| Field | Detail |
|-------|--------|
| **Why** | Enforce line-level invariants via class-based static methods |
| **What** | `PurchaseOrderLineInvariants` class with static method: `enforcePurchaseOrderLineQuantity` |
| **Who** | PurchaseOrder aggregate line operations |
| **Whom** | Line entity validation |
| **Adapter** | N/A |

### `domain/factories/purchase-order.factory.ts`

| Field | Detail |
|-------|--------|
| **Why** | Only sanctioned build path for PurchaseOrder aggregates |
| **What** | `PurchaseOrderFactory.create(...)` and `openPoForReceipt(...)`; calls invariant classes statically |
| **Who** | `CreatePurchaseOrderUseCase`, `ImportPurchaseOrderUseCase`, `RegisterPurchaseOrderReceiptUseCase` |
| **Whom** | `PurchaseOrder` aggregate, `PurchaseOrderInvariants` |
| **Adapter** | N/A |

### `domain/repositories/purchase-order-command.repository.ts`

| Field | Detail |
|-------|--------|
| **Why** | Command repository port — abstract class used as DI token for write operations |
| **What** | Abstract methods: `save`, `update`, `findById`, `findByExternalReference` |
| **Who** | Command use cases |
| **Whom** | `PrismaPurchaseOrderCommandRepository` (adapter) |
| **Adapter** | `PrismaPurchaseOrderCommandRepository` (`infrastructure/persistence/prisma/prisma-purchase-order-command.repository.ts`) |

### `domain/services/purchase-order-pricing.service.ts`

| Field | Detail |
|-------|--------|
| **Why** | Pricing calculations for purchase orders and lines |
| **What** | `lineTotal(unitPrice, quantity)`, `toMoney(amount, currency)` helpers |
| **Who** | `PurchaseOrder` aggregate (`addLine`, `setLine`, `amend`) |
| **Whom** | `Money` value object |
| **Adapter** | N/A |

### `domain/services/purchase-order-approval.service.ts`

| Field | Detail |
|-------|--------|
| **Why** | Approval logic service (may be superseded by `can-approve.policy.ts`) |
| **What** | Approval decision helpers |
| **Who** | Transition use case (historical) |
| **Whom** | `can-approve.policy.ts` |
| **Adapter** | N/A |

### `domain/services/purchase-order-receipt.service.ts`

| Field | Detail |
|-------|--------|
| **Why** | Receipt quantity calculations |
| **What** | Open/received quantity logic |
| **Who** | GRN-related use cases |
| **Whom** | `OpenQuantityService` |
| **Adapter** | N/A |

### `domain/services/open-quantity.service.ts`

| Field | Detail |
|-------|--------|
| **Why** | Open (remaining) quantity computation per line |
| **What** | `openQuantity(ordered, received)` |
| **Who** | `RegisterPurchaseOrderReceiptUseCase`, query use cases |
| **Whom** | `PurchaseOrderLine` |
| **Adapter** | N/A |

### `domain/services/purchase-order-status.service.ts`

| Field | Detail |
|-------|--------|
| **Why** | Receipt status derivation |
| **What** | `deriveReceiptStatus(lines)` → `FULL` / `PARTIAL` / `NOT_RECEIVED` |
| **Who** | `RegisterPurchaseOrderReceiptUseCase` |
| **Whom** | `PurchaseOrderLine` |
| **Adapter** | N/A |

### `domain/services/purchase-order-recurring-line.service.ts`

| Field | Detail |
|-------|--------|
| **Why** | Recurring purchase order line generation logic |
| **What** | Line template handling for recurring POs |
| **Who** | `GenerateRecurringPurchaseOrderUseCase` |
| **Whom** | Recurring domain types |
| **Adapter** | N/A |

### `domain/policies/approval.policy.ts`

| Field | Detail |
|-------|--------|
| **Why** | Enforce approval policy via class-based static methods |
| **What** | `ApprovalPolicy` class with static method: `enforcePurchaseOrderApproval(status, totalAmount, autoApproveThreshold)` |
| **Who** | `ApprovePurchaseOrderUseCase` calls `ApprovalPolicy.enforcePurchaseOrderApproval()` statically |
| **Whom** | `PurchaseOrder` aggregate approve transition |
| **Adapter** | N/A |

### `domain/policies/can-approve.policy.ts`

| Field | Detail |
|-------|--------|
| **Why** | Replace inline `ConflictException` throw in transition use case with domain policy |
| **What** | `CanApprovePolicy` class with static method: `enforcePurchaseOrderCanApprove(status, totalAmount, autoApproveThreshold)` returns boolean |
| **Who** | `ApprovePurchaseOrderUseCase` calls `CanApprovePolicy.enforcePurchaseOrderCanApprove()` statically |
| **Whom** | `PurchaseOrder` aggregate approve transition |
| **Adapter** | N/A |

### `domain/policies/cancellation.policy.ts`

| Field | Detail |
|-------|--------|
| **Why** | Cancellation rules via class-based static methods |
| **What** | `CancellationPolicy` class with static method: `enforcePurchaseOrderCancellation(status, hasReceipts)` |
| **Who** | `CancelPurchaseOrderUseCase` calls `CancellationPolicy.enforcePurchaseOrderCancellation()` statically |
| **Whom** | `PurchaseOrder.aggregate.cancel()` |
| **Adapter** | N/A |

### `domain/policies/over-receipt.policy.ts`

| Field | Detail |
|-------|--------|
| **Why** | Over-receipt tolerance enforcement via class-based static methods |
| **What** | `OverReceiptPolicy` class with static method: `enforcePurchaseOrderOverReceipt(orderedQuantity, alreadyReceived, proposedQuantity, tolerance)` |
| **Who** | Receipt registration flow calls `OverReceiptPolicy.enforcePurchaseOrderOverReceipt()` statically |
| **Whom** | `PurchaseOrder` aggregate receipt flow |
| **Adapter** | N/A |

### `domain/types/purchase-order.types.ts`

| Field | Detail |
|-------|--------|
| **Why** | Type aliases, enums, props, request/query record types |
| **What** | `PurchaseOrderStatus` enum, `PurchaseOrderProps`, `CreatePurchaseOrderRequest`, `PurchaseOrderTransitionRequest`, `AddLineRequest`, `UpdatePurchaseOrderLineRequest`, `RemoveLineRequest` |
| **Who** | All use cases, controller DTOs, factory |
| **Whom** | Value objects, aggregate |
| **Adapter** | N/A |

### `domain/types/purchase-order.enum.ts`

| Field | Detail |
|-------|--------|
| **Why** | Status and action enums |
| **What** | `PurchaseOrderStatus` (DRAFT, SUBMITTED, APPROVED, ISSUED, COMPLETED, REJECTED, CANCELLED) |
| **Who** | Aggregate, use cases, types |
| **Whom** | `purchase-order.types.ts` |
| **Adapter** | N/A |

### `domain/events/*.event.ts` (10 files)

| File | Why | What | Who | Whom |
|------|-----|------|-----|------|
| `purchase-order.created.event.ts` | Creation event | Payload: order data | Create use case | Outbox → brokers |
| `purchase-order.submitted.event.ts` | Submit transition | PO id, number, vendorId | `submit()` | Outbox |
| `purchase-order.approved.event.ts` | Approve transition | PO id | `approve()` | Outbox |
| `purchase-order.rejected.event.ts` | Reject transition | PO id, reason | `reject()` | Outbox |
| `purchase-order.issued.event.ts` | Issue transition | PO id | `issue()` | Outbox |
| `purchase-order.cancelled.event.ts` | Cancel transition | PO id | `cancel()` | Outbox |
| `purchase-order.completed.event.ts` | Close/complete | PO id | `close()` | Outbox |
| `purchase-order.amended.event.ts` | Amendment | applied changes, reason, actorId | `amend()` | Outbox |
| `purchase-order.line-added.event.ts` | Line added | PO id, productId | `addLine`/`setLine` | Outbox |
| `purchase-order.line-removed.event.ts` | Line removed | PO id, productId | `removeLine` | Outbox |

**Adapter**: `OutboxAdapter` writes all to `outbox_messages` via `PurchaseOrderPublisherPort`.

### `domain/value-objects/purchase-order-id.vo.ts`

| Field | Detail |
|-------|--------|
| **Why** | Typed ID value object for PurchaseOrder |
| **What** | `PurchaseOrderId` class (extends `ValueObject<string>`) |
| **Who** | Aggregate, repositories, use cases |
| **Whom** | `AggregateRoot` base |
| **Adapter** | N/A |

### `domain/value-objects/order-number.vo.ts`

| Field | Detail |
|-------|--------|
| **Why** | Order number value object (`PO-00000001` format) |
| **What** | `OrderNumber` class with validation |
| **Who** | Factory, aggregate |
| **Whom** | `OrderNumber` invariants |
| **Adapter** | N/A |

### `domain/value-objects/order-number.invariants.ts`

| Field | Detail |
|-------|--------|
| **Why** | Order number format invariants via class-based static methods |
| **What** | `OrderNumberInvariants` class with static method: `enforceOrderNumberCreate(orderNumber)` |
| **Who** | Imported by factory |
| **Whom** | `OrderNumberInvariants.enforceOrderNumberCreate()` |
| **Adapter** | N/A |

### `domain/value-objects/product-id-ref.vo.ts`

| Field | Detail |
|-------|--------|
| **Why** | Reference to a Product (by id only, no coupling) |
| **What** | `ProductIdRef` class |
| **Who** | `PurchaseOrderLine` |
| **Whom** | Aggregate lines |
| **Adapter** | N/A |

### `domain/value-objects/vendor-id-ref.vo.ts`

| Field | Detail |
|-------|--------|
| **Why** | Reference to a Vendor (by id only) |
| **What** | `VendorIdRef` class |
| **Who** | Aggregate |
| **Whom** | Vendor reference |
| **Adapter** | N/A |

---

## Application Layer — Use Cases

| File | Why | What | Who | Whom | Adapter |
|------|-----|------|-----|------|---------|
| `create-purchase-order.usecase.ts` | Create a new DRAFT PO | Factory → vendor check → numbering → save → outbox | Controller | `OrderableVendorPort`, `NumberingPort`, `PurchaseOrderCommandRepository`, `PurchaseOrderPublisherPort`, `RequestContextPort`, `AbacPort` | `OrderableVendorAdapter`, `NumberingAdapter`, `PrismaPurchaseOrderCommandRepository`, `OutboxAdapter` |
| `add-purchase-order-line.usecase.ts` | Add a line to DRAFT PO | Product check → `addLine` → save → outbox | Controller | `PurchasableProductPort`, `PurchaseOrderCommandRepository`, `PurchaseOrderPublisherPort`, `RequestContextPort`, `AbacPort` | `PurchasableProductAdapter`, `PrismaPurchaseOrderCommandRepository`, `OutboxAdapter` |
| `update-purchase-order-line.usecase.ts` | Rewrite a draft line (`setLine`) | Product check → `setLine` → conditional save → outbox | Controller | `PurchasableProductPort`, `PurchaseOrderCommandRepository`, `PurchaseOrderPublisherPort`, `RequestContextPort`, `AbacPort` | `PurchasableProductAdapter`, `PrismaPurchaseOrderCommandRepository`, `OutboxAdapter` |
| `remove-purchase-order-line.usecase.ts` | Remove a draft line | `removeLine` → save → outbox | Controller | `PurchaseOrderCommandRepository`, `PurchaseOrderPublisherPort`, `RequestContextPort`, `AbacPort` | `PrismaPurchaseOrderCommandRepository`, `OutboxAdapter` |
| `purchase-order-transition.usecase.ts` | Single mutation path (submit/approve/reject/cancel/complete) | Policy checks → status transition → audit → outbox | Controller | `PurchaseOrderCommandRepository`, `PurchaseOrderQuery`, `PurchaseOrderPublisherPort`, `RequestContextPort`, `AbacPort`, `AuditPort` | `PrismaPurchaseOrderCommandRepository`, `PrismaPurchaseOrderQueryRepository`, `OutboxAdapter` |
| `amend-purchase-order.usecase.ts` | Controlled amendment of ISSUED PO | `amend()` → save → outbox | Controller | `PurchaseOrderCommandRepository`, `PurchaseOrderPublisherPort`, `RequestContextPort`, `AbacPort` | `PrismaPurchaseOrderCommandRepository`, `OutboxAdapter` |
| `issue-purchase-order.usecase.ts` | Issue PO (APPROVED → ISSUED) | `issue()` → save → outbox | Controller | `PurchaseOrderCommandRepository`, `PurchaseOrderPublisherPort`, `RequestContextPort`, `AbacPort` | `PrismaPurchaseOrderCommandRepository`, `OutboxAdapter` |
| `close-purchase-order.usecase.ts` | Close/Complete PO | `close()` → save → outbox | Controller | `PurchaseOrderCommandRepository`, `PurchaseOrderPublisherPort`, `RequestContextPort`, `AbacPort` | `PrismaPurchaseOrderCommandRepository`, `OutboxAdapter` |
| `register-purchase-order-receipt.usecase.ts` | Register receipt against PO | PO eligibility → `openPoForReceipt` → save → outbox | GRN listener / controller | `PurchaseOrderCommandRepository`, `RequestContextPort`, `AbacPort` | `PrismaPurchaseOrderCommandRepository` |
| `import-purchase-order.usecase.ts` | Find-or-create DRAFT PO by external reference (idempotent import) | Find-or-create → `setLine` per row → save → cache invalidation | Import handler | `OrderableVendorPort`, `NumberingPort`, `RequestContextPort`, `AbacPort`, `ReadCachePort` | `OrderableVendorAdapter`, `NumberingAdapter`, `ReadCacheAdapter` |
| `get-purchase-order.usecase.ts` | Get single PO | Read through query port | Controller | `PurchaseOrderQuery` | `PrismaPurchaseOrderQueryRepository` |
| `list-purchase-orders.usecase.ts` | List POs | Read through query port | Controller | `PurchaseOrderQuery` | `PrismaPurchaseOrderQueryRepository` |
| `get-purchase-order-receipts.usecase.ts` | Get receipts for PO | Read-only | Controller | `PurchaseOrderQuery` | `PrismaPurchaseOrderQueryRepository` |
| `get-purchase-order-remaining-quantities.usecase.ts` | Remaining quantities per line | Read-only | Controller | `PurchaseOrderQuery` | `PrismaPurchaseOrderQueryRepository` |
| `has-purchase-order-receipts.usecase.ts` | Check if PO has posted receipts | Read-only | `PurchaseOrder.cancel()` (caller-supplied) | `PurchaseOrderQuery` | `PrismaPurchaseOrderQueryRepository` |
| `create-recurring-purchase-order.usecase.ts` | Create recurring PO template | Create template | Controller | Recurring domain | Recurring module |
| `create-recurring-from-purchase-order.usecase.ts` | Create recurring from existing PO | Derive template from PO | Controller | Recurring domain | Recurring module |
| `generate-recurring-purchase-order.usecase.ts` | Generate PO from recurring template | Execute recurrence | Recurring scheduler | Recurring domain | Recurring module |
| `handle-vendor-bill-posted.usecase.ts` | Handle inbound `VendorBillPosted` event | Acknowledge vendor bill posting | `VendorBillPostedListener` | `RequestContextPort` | N/A |

---

## Application Layer — Queries

### `application/queries/purchase-order.query.ts`

| Field | Detail |
|-------|--------|
| **Why** | Query repository port — abstract class used as DI token for read operations |
| **What** | Abstract methods: `getPurchaseOrder`, `listPurchaseOrders`, `getPurchaseOrderReceipts`, `getRemainingQuantities`, `hasReceipts`, `getPurchasableProduct` |
| **Who** | Query use cases, transition use case (`hasReceipts`) |
| **Whom** | `PrismaPurchaseOrderQueryRepository` |
| **Adapter** | `PrismaPurchaseOrderQueryRepository` |

---

## Application Layer — Facades

### `application/facades/purchase-order-for-grn.facade.ts`

| Field | Detail |
|-------|--------|
| **Why** | Public port implementation consumed by GoodReceiptNote module |
| **What** | `PurchaseOrderForGrnFacade` implementing `PurchaseOrderForGrnPort`; delegates to query use cases |
| **Who** | `GoodReceiptNote` module via `PurchaseOrderPort` outbound adapter |
| **Whom** | `PurchaseOrderForGrnPort`, query use cases |
| **Adapter** | N/A (is the adapter for GRN's `PurchaseOrderPort`) |

---

## Application Layer — Integrations — Publishes

### `application/integrations/publishes/purchase-order.publisher-port.ts`

| Field | Detail |
|-------|--------|
| **Why** | Integration port — send-to-outbox abstraction for PO domain events |
| **What** | Abstract `PurchaseOrderPublisherPort` with `send(event, aggregateId)` |
| **Who** | All command use cases |
| **Whom** | `OutboxAdapter` |
| **Adapter** | `OutboxAdapter` (`infrastructure/adapters/platform/outbox.adapter.ts`) |

### `application/integrations/publishes/purchase-order.released.publisher-event.ts`

| Field | Detail |
|-------|--------|
| **Why** | Typed wire shape for `PurchaseOrderReleased` integration event |
| **What** | Event type constant + payload shape |
| **Who** | Outbox publisher |
| **Whom** | Broker consumers |
| **Adapter** | N/A |

---

## Application Layer — Integrations — Listens

| File | Why | What | Who | Whom | Adapter |
|------|-----|------|-----|------|---------|
| `goods-receipt-posted.listener.ts` | Consume `GoodsReceiptPosted` from GRN | Inbox receive → `RegisterPurchaseOrderReceiptUseCase` → complete/fail | Outbox scheduler / broker | `InboxPort`, `RequestContextPort` | N/A |
| `vendor-bill-posted.listener.ts` | Consume `VendorBillPosted` | Inbox receive → `HandleVendorBillPostedUseCase` → complete/fail | Outbox scheduler / broker | `InboxPort`, `RequestContextPort` | N/A |
| `recurring-occurrence-requested.rabbitmq.listener-event.ts` | Consume recurring occurrence | Delegate to recurring generation | Recurring module | RabbitMQ adapter | N/A |

### `application/integrations/listens/*.listener-event.ts` (event files)

| Field | Detail |
|-------|--------|
| **Why** | Typed envelope shapes per consumed event type |
| **What** | `eventType` constants, payload interfaces |
| **Who** | Listener classes |
| **Whom** | Outbox in-process bus / broker adapters |
| **Adapter** | N/A |

---

## Application Layer — Outbound Ports

| File | Why | What | Who | Whom | Adapter |
|------|-----|------|-----|------|---------|
| `vendor-query.port.ts` | Query vendor orderability | `getOrderableVendor(id)` | Create/Import use cases | `VendorModule: VendorForPurchaseFacade` | `OrderableVendorAdapter` |
| `product-query.port.ts` | Query purchasable product | `getPurchasableProduct(id)` | Add/Update line use cases | `ProductModule: ProductForPurchaseFacade` | `PurchasableProductAdapter` |
| `numbering.port.ts` | Document numbering | `nextNumber(key, opts)` | Create/Import use cases | `platform/numbering` | `NumberingAdapter` |
| `read-cache.port.ts` | Read-model cache | `get`/`invalidate` | Import use case | `platform/cache` | `ReadCacheAdapter` |
| `company-config.port.ts` | Company config (module-local) | `getCompanyConfig()` | (Removed from usecases in Phase 3 — now via CLS) | `platform/configuration` | `CompanyConfigAdapter` |
| `approval-workflow.port.ts` | Approval workflow | — | — | — | `ApprovalWorkflowAdapter` |
| `budget-check.port.ts` | Budget check | — | — | — | `BudgetCheckAdapter` |
| `currency-rate.port.ts` | Currency conversion | — | — | — | `CurrencyRateAdapter` |
| `supplier-network.port.ts` | Supplier network | — | — | — | `SupplierNetworkAdapter` |
| `tax-calculation.port.ts` | Tax calculation | — | — | — | `TaxCalculationAdapter` |

---

## Infrastructure Layer — Persistence (Prisma)

### `infrastructure/persistence/prisma/prisma-purchase-order-command.repository.ts`

| Field | Detail |
|-------|--------|
| **Why** | Prisma implementation of `PurchaseOrderCommandRepository` |
| **What** | `save`, `update`, `findById`, `findByExternalReference` using `TransactionHost` |
| **Who** | `PurchaseOrderCommandRepository` port binding |
| **Whom** | Prisma client, `PurchaseOrder` aggregate rows |
| **Adapter** | Implements `PurchaseOrderCommandRepository` |

### `infrastructure/persistence/prisma/prisma-purchase-order-query.repository.ts`

| Field | Detail |
|-------|--------|
| **Why** | Prisma implementation of `PurchaseOrderQuery` (read-only, `PrismaReadPort`) |
| **What** | `getPurchaseOrder`, `listPurchaseOrders`, `getPurchaseOrderReceipts`, `getRemainingQuantities`, `hasReceipts` |
| **Who** | `PurchaseOrderQuery` port binding |
| **Whom** | Prisma read replica, `purchase_orders` / `purchase_order_lines` tables |
| **Adapter** | Implements `PurchaseOrderQuery` |

### `infrastructure/persistence/prisma/prisma-purchase-order.mapper.ts`

| Field | Detail |
|-------|--------|
| **Why** | Domain ↔ Prisma row mapping |
| **What** | `toDomain(row)`, `toRow(entity)` mappers |
| **Who** | Command and query repositories |
| **Whom** | Prisma rows, `PurchaseOrder` aggregate |
| **Adapter** | N/A |

### `infrastructure/persistence/prisma/prisma-get-purchase-order.adapter.ts`

| Field | Detail |
|-------|--------|
| **Why** | Specialized get adapter |
| **What** | Single PO fetch logic |
| **Who** | Query repository |
| **Whom** | Prisma |
| **Adapter** | N/A |

### `infrastructure/persistence/prisma/prisma-list-purchase-order.adapter.ts`

| Field | Detail |
|-------|--------|
| **Why** | Specialized list adapter |
| **What** | Paginated list query |
| **Who** | Query repository |
| **Whom** | Prisma |
| **Adapter** | N/A |

### `infrastructure/persistence/prisma/prisma-purchase-order-number-uniqueness-check.adapter.ts`

| Field | Detail |
|-------|--------|
| **Why** | Ensure order number uniqueness within company |
| **What** | Uniqueness check query |
| **Who** | Numbering flow |
| **Whom** | Prisma `document_number_sequences` table |
| **Adapter** | N/A |

---

## Infrastructure Layer — Adapters — Platform

| File | Why | What | Who | Whom | Implements Port |
|------|-----|------|-----|------|-----------------|
| `outbox.adapter.ts` | Write PO events to transactional outbox | `send(event, aggregateId)` → `OutboxWriterPort.append` | All command use cases | `platform/outbox` | `PurchaseOrderPublisherPort` |
| `numbering.adapter.ts` | Allocate PO numbers | `nextNumber('purchase-order.number', ...)` | Create/Import use cases | `platform/numbering` | `NumberingPort` |
| `read-cache.adapter.ts` | Cache read models | `get`/`invalidate` | Import use case | `platform/cache` | `ReadCachePort` |
| `company-config.adapter.ts` | Company config (legacy binding) | `getCompanyConfig()` | (No longer injected into usecases) | `platform/configuration` | `CompanyConfigPort` |
| `approval-workflow.adapter.ts` | Approval workflow adapter | — | — | — | `ApprovalWorkflowPort` |
| `currency-rate.adapter.ts` | Currency rate | — | — | — | `CurrencyRatePort` |
| `tax-calculation.adapter.ts` | Tax calculation | — | — | — | `TaxCalculationPort` |
| `purchase-order-batch-operation.adapter.ts` | Batch operation handler | `aggregateType()`, `supportedOperations()`, `validate()`, `execute()` | Batch module registry | `platform/batch-operation` | `BatchOperationHandler` |
| `purchase-order-notification.adapter.ts` | Notification handler | — | Notification module | `platform/notification` | `NotificationHandler` |
| `purchase-order-import.adapter.ts` | Import opt-in handler | Register import handler | Import module bridge | `platform/import` | `ImportHandler` |

---

## Infrastructure Layer — Adapters — Business Aggregate (Consumer Side)

| File | Why | What | Who | Whom | Implements Port |
|------|-----|------|-----|------|-----------------|
| `orderable-vendor.adapter.ts` | Consume Vendor's `OrderableVendorPort` | `getOrderableVendor(id)` → calls `VendorModule` facade | Create/Import use cases | `VendorModule: VendorForPurchaseFacade` | `OrderableVendorPort` (PO's outbound port) |
| `purchasable-product.adapter.ts` | Consume Product's `PurchasableProductPort` | `getPurchasableProduct(id)` → calls `ProductModule` facade | Add/Update line use cases | `ProductModule: ProductForPurchaseFacade` | `PurchasableProductPort` (PO's outbound port) |
| `vendor-eligibility.adapter.ts` | Vendor eligibility check | — | — | — | — |
| `budget-check.adapter.ts` | Budget check adapter | — | — | — | `BudgetCheckPort` |
| `supplier-network.adapter.ts` | External supplier network | — | — | — | `SupplierNetworkPort` |

---

## Presentation Layer — HTTP

### `presentation/http/purchase-order.controller.ts`

| Field | Detail |
|-------|--------|
| **Why** | Thin controller — injects use cases, calls `execute`, returns `{data, message}` |
| **What** | REST endpoints for all PO operations; no inline business logic |
| **Who** | HTTP clients |
| **Whom** | All command and query use cases |
| **Adapter** | N/A |

### Request DTOs (`presentation/http/requests/`)

| File | Why | What | Who |
|------|-----|------|-----|
| `create-purchase-order.request.dto.ts` | Create PO input validation | Zod schema via `createZodDto` | Controller → `CreatePurchaseOrderUseCase` |
| `add-purchase-order-line.request.dto.ts` | Add line input | Zod schema | Controller → `AddPurchaseOrderLineUseCase` |
| `update-purchase-order-line.request.dto.ts` | Update line input | Zod schema | Controller → `UpdatePurchaseOrderLineUseCase` |
| `amend-purchase-order.request.dto.ts` | Amendment input | Zod schema | Controller → `AmendPurchaseOrderUseCase` |
| `update-purchase-order.request.dto.ts` | Header update input | Zod schema | Controller → `UpdatePurchaseOrderUseCase` |
| `reject-purchase-order.request.dto.ts` | Reject input | Zod schema | Controller → transition use case |
| `create-recurring-purchase-order.request.dto.ts` | Recurring template input | Zod schema | Controller → recurring use case |
| `create-recurring-from-purchase-order.request.dto.ts` | Recurring from PO input | Zod schema | Controller → recurring use case |
| `query-purchase-orders.request.dto.ts` | List query params | Zod schema | Controller → list use case |
| `recurring-purchase-order.schema.ts` | Recurring schema | Shared schema | Recurring DTOs |

### Response DTOs (`presentation/http/responses/`)

| File | Why | What |
|------|-----|------|
| `create-purchase-order.web.response.dto.ts` | Web (full) response shape | Zod response DTO |
| `create-purchase-order.mobile.response.dto.ts` | Mobile (minimal) response shape | Zod response DTO |
| `get-purchase-order.web.response.dto.ts` | Get PO web response | Zod response DTO |
| `get-purchase-order.mobile.response.dto.ts` | Get PO mobile response | Zod response DTO |
| `list-purchase-orders.web.response.dto.ts` | List web response | Zod response DTO |
| `list-purchase-orders.mobile.response.dto.ts` | List mobile response | Zod response DTO |
| `id.response.dto.ts` | Generic ID response | Zod response DTO |

---

## Public Layer

### `public/contracts/purchase-order-for-grn.contract.ts`

| Field | Detail |
|-------|--------|
| **Why** | Plain reference shape exported to GRN module |
| **What** | `PurchaseOrderReference` — id, number, vendorId, status, lines |
| **Who** | GRN module via `PurchaseOrderPort` |
| **Whom** | `PurchaseOrderForGrnPort` |
| **Adapter** | N/A |

### `public/contracts/purchase-order-receipt.contract.ts`

| Field | Detail |
|-------|--------|
| **Why** | Receipt request/result contract |
| **What** | `PurchaseOrderReceiptRequest`, `PurchaseOrderReceiptResult` |
| **Who** | `RegisterPurchaseOrderReceiptUseCase`, GRN module |
| **Whom** | Use case |
| **Adapter** | N/A |

### `public/ports/purchase-order-for-grn.port.ts`

| Field | Detail |
|-------|--------|
| **Why** | Abstract-class port exported to GRN module |
| **What** | `PurchaseOrderForGrnPort` with query methods |
| **Who** | GRN module's `PurchaseOrderAdapter` |
| **Whom** | `PurchaseOrderForGrnFacade` |
| **Adapter** | `PurchaseOrderForGrnFacade` (bound via `useExisting` in module) |

### `public/index.ts`

| Field | Detail |
|-------|--------|
| **Why** | Single entry point other modules may import |
| **What** | Re-exports contracts and ports only |
| **Who** | Consumer modules |
| **Whom** | `public/contracts/`, `public/ports/` |
| **Adapter** | N/A |

---

## Module File

### `purchase-order.module.ts`

| Field | Detail |
|-------|--------|
| **Why** | NestJS composition root — bindings and exports only |
| **What** | Imports `PlatformModule`, `ProductModule`, `VendorModule`; registers all use cases, repositories, adapters, listeners, facade; exports `PurchaseOrderForGrnPort` |
| **Who** | `BusinessModule` |
| **Whom** | All registered providers |
| **Adapter** | N/A |

---

## Summary Table: Port → Adapter Mapping

| Port (token) | Defined in | Implemented by (adapter) | Location |
|--------------|-----------|-------------------------|----------|
| `PurchaseOrderCommandRepository` | `domain/repositories/` | `PrismaPurchaseOrderCommandRepository` | `infrastructure/persistence/prisma/` |
| `PurchaseOrderQuery` | `application/queries/` | `PrismaPurchaseOrderQueryRepository` | `infrastructure/persistence/prisma/` |
| `PurchaseOrderPublisherPort` | `application/integrations/publishes/` | `OutboxAdapter` | `infrastructure/adapters/platform/` |
| `NumberingPort` | `application/outbound-ports/` | `NumberingAdapter` | `infrastructure/adapters/platform/` |
| `ReadCachePort` | `application/outbound-ports/` | `ReadCacheAdapter` | `infrastructure/adapters/platform/` |
| `CompanyConfigPort` (module-local) | `application/outbound-ports/` | `CompanyConfigAdapter` | `infrastructure/adapters/platform/` |
| `OrderableVendorPort` | `application/outbound-ports/` | `OrderableVendorAdapter` | `infrastructure/adapters/business-aggregate/` |
| `PurchasableProductPort` | `application/outbound-ports/` | `PurchasableProductAdapter` | `infrastructure/adapters/business-aggregate/` |
| `PurchaseOrderForGrnPort` (exported) | `public/ports/` | `PurchaseOrderForGrnFacade` (useExisting) | `application/facades/` |
