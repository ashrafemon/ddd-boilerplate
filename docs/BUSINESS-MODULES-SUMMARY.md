# Business Modules Summary

This document summarizes the business modules (aggregates) of the ERP DDD boilerplate,
with enough detail for a reader to understand what each module does: actions, use cases,
listeners, domain invariants, policies, and events.

## Shared business primitives

- `AggregateRoot<ID>` (version + `addEvent`/`pullEvents` drain), `Entity<ID>`, `ValueObject<T>`, `DomainEvent`.
- Registries: `invariantRegistry` (keyed invariants, `enforce()`), `policyRegistry` (keyed policies, `evaluate()`/`enforce()`).
- Value objects: `Money` (minor units), `VendorId`.

## Module: Product (`procurement/product`)

- Aggregate: `Product` (status ACTIVE/INACTIVE/DISCONTINUED).
- Behavior: create, update, changePrice, activate, deactivate, discontinue, isPurchasable.
- Invariants: non-negative price (`product.create`); legal transitions (`product.status-transition`, DISCONTINUED terminal).
- Policy: `product.reactivation` (discontinued cannot be reactivated).
- Events: ProductCreated/Updated/Activated/Deactivated/Discontinued.
- Use cases: create-product, update-product, change-price, product-status (activate/deactivate/discontinue), get-product, get-purchasable-product(s), list-products, find-purchasable-products-by-skus.
- Cross-module: PurchasableProductPort (consumed by PO).

## Module: Vendor (`party/vendor`)

- Aggregate: `Vendor` (status ACTIVE/INACTIVE/BLOCKED).
- Behavior: create, update, activate, deactivate, block.
- Policy: `vendor.orderability` (blocked/inactive never orderable).
- Events: VendorCreated/Updated/Activated/Deactivated/Blocked.
- Use cases: create-vendor, update-vendor, vendor-status, get-vendor, get-orderable-vendor, list-vendors, find-orderable-vendors-by-codes.
- Cross-module: OrderableVendorPort (consumed by PO).

## Module: Purchase Order (`procurement/purchase-order`)

Aggregate: `PurchaseOrder` owns `PurchaseOrderLine[]` (same product merges quantities). References products/vendors by id only.

Status machine:

```
DRAFT -> submit -> SUBMITTED -> approve -> APPROVED -> (issue) -> ISSUED -> complete -> COMPLETED
                     |               |
                     |- reject -> REJECTED
                     |- cancel -> CANCELLED (from DRAFT/SUBMITTED/APPROVED)
```

Commands:
- create-purchase-order
- update-purchase-order (header, DRAFT only)
- add-purchase-order-line / update-purchase-order-line / remove-purchase-order-line
- purchase-order-transition (submit/approve/reject/cancel)
- issue-purchase-order
- close-purchase-order
- register-purchase-order-receipt (SKIPPED for now; uses factory `openPoForReceipt`)
- import-purchase-order
- create-recurring-purchase-order / create-recurring-from-purchase-order / generate-recurring-purchase-order

Queries:
- get-purchase-order, list-purchase-orders
- get-purchase-order-receipts, get-purchase-order-remaining-quantities
- has-purchase-order-receipts

Invariants:
- `purchase-order.has-lines` (>=1 line before submit)
- `purchase-order.line-quantity` / `purchase-order-line.quantity-positive` (positive integer)
- `purchase-order.status-transition` (legal transitions; ISSUED only -> COMPLETED)
- `purchase-order.editable` (DRAFT only)

Policies:
- `purchase-order.approval` (total > autoApproveThreshold requires manual approval)
- `purchase-order.over-receipt` (over-receipt tolerance)
- `purchase-order.cancellation` (cancellation policy)

Events:
- PurchaseOrderCreated/Submitted/Approved/Rejected/Cancelled/Completed
- PurchaseOrderIssued/Closed
- LineAdded/LineRemoved

Listeners (per transport): purchase-order.created (event-emitter, kafka, rabbitmq, sqs); recurring-occurrence-requested (rabbitmq).

Cross-module ports: PurchasableProductPort (-> Product), OrderableVendorPort (-> Vendor). Exposes PurchaseOrderForGrnPort (-> GRN) and GrnForPurchaseOrderPort (reserved).

## Module: Good Receipt Note (`procurement/good-receipt-note`)

Aggregate: `GoodReceiptNote` owns `GrnLine[]` (accepted/rejected quantities; re-receiving accumulates). Status DRAFT/RECEIVED/COMPLETED/CANCELLED.

Commands: create-grn, add-grn-line, receive-grn, post-grn, complete-grn, cancel-grn, reverse-grn, record-inspection-result.

Queries: get-grn, list-grns.

Invariants/policies: inspection balance, over-receipt, etc. Events: GrnCreated/LineAdded/Received/Completed/Cancelled/Reversed/Posted.

Listeners: grn.created (event-emitter, kafka, rabbitmq, sqs). Cross-module: PurchaseOrderPort (-> PO). Exposes GrnForPurchaseOrderPort (reserved).

## Module: Stock Movement (`inventory/stock-movement`)

Commands: record-stock-movement, record-stock-movement-reversal. Query: get-stock-level. Listeners: goods-receipt-posted consumer, goods-receipt-reversed consumer.

## Module: Invoice (`sales/invoice`)

Commands: create-invoice, post-invoice, generate-recurring-invoice. Queries: get-invoice, list-invoices. Listeners: invoice.created (transports), recurring-occurrence-requested (rabbitmq).

## Notes

- `register-purchase-order-receipt.usecase` is currently SKIPPED (not following architecture); reminder to refactor later.
- Cache is intended to be applied via request/response interceptor, not via business use cases; extra cached-get usecases removed.
- Use cases/facades are orchestration only; domain factory owns invariants/policies/logic.
