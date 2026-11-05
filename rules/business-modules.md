# Business Modules — Implemented

Business code lives under `src/business`. Modules:

- `party/vendor`
- `procurement/product`
- `procurement/purchase-order`
- `procurement/good-receipt-note`
- `sales/invoice`
- `shared-business` (primitives, registries, ports)

Schema-only (no `src/business` module): `inventory/stock-movement`.

## Module: party/vendor

Aggregate: `Vendor`. Files: `src/business/party/vendor`.

Domain:
- Aggregate: `domain/aggregates/vendor.aggregate.ts`, `vendor.invariants.ts`
- Events: `vendor.created`, `vendor.updated`, `vendor.activated`, `vendor.deactivated`, `vendor.blocked`
- Factory: `domain/factories/vendor.factory.ts`
- Policy: `domain/policies/orderability.policy.ts`
- Repository port: `domain/repositories/vendor-command.repository.ts`
- Value objects: `vendor-id.vo.ts`, `vendor-code.invariants.ts`, `vendor-name.invariants.ts`, `vendor-email.invariants.ts`, `vendor.vos.ts`
- Types/enums: `vendor.enum.ts`, `vendor.types.ts`

Application:
- Use cases: `create-vendor`, `get-vendor`, `list-vendors`, `update-vendor`, `vendor-status`, `get-orderable-vendor`, `find-orderable-vendors-by-codes`
- Facade: `vendor-for-purchase.facade.ts`
- Outbound ports: `company-config.port.ts`
- Integrations publishes: `vendor.publisher-port.ts`
- Queries: `vendor.query.ts`

Infrastructure:
- Adapters: `company-config.adapter.ts`, `outbox.adapter.ts`, `vendor-import.adapter.ts`
- Persistence: `prisma-vendor-command.repository.ts`, `prisma-vendor-query.repository.ts`, `prisma-vendor.mapper.ts`

Presentation: `vendor.controller.ts` + request/response DTOs.

Public: `contracts/vendor-for-purchase.contract.ts`, `ports/vendor-for-purchase.port.ts`.

Endpoints:
- `POST /vendors`
- `GET /vendors`
- `GET /vendors/:id`
- `PATCH /vendors/:id`
- `PATCH /vendors/:id/activate`
- `PATCH /vendors/:id/deactivate`
- `PATCH /vendors/:id/block`

## Module: procurement/product

Aggregate: `Product`.

Domain:
- Aggregate: `product.aggregate.ts`, `product.invariants.ts`
- Events: `product.created`, `product.updated`, `product.activated`, `product.deactivated`, `product.discontinued`
- Factory: `product.factory.ts`
- Policy: `reactivation.policy.ts`
- Value objects: `product-name.invariants.ts`, `sku.invariants.ts`, plus `product-id.vo.ts`, `product-sku.vo.ts`, etc.
- Types: `product.enum.ts`, `product.types.ts`

Application: use cases for create/get/list/update/activate/deactivate/discontinue/change-price; query `product.query.ts`.

Endpoints:
- `POST /products`
- `GET /products`
- `GET /products/:id`
- `PATCH /products/:id`
- `PATCH /products/:id/change-price`
- `PATCH /products/:id/activate`
- `PATCH /products/:id/deactivate`
- `PATCH /products/:id/discontinue`

## Module: procurement/purchase-order

Aggregate: `PurchaseOrder` (+ `PurchaseOrderLine` entity). Largest module.

Domain:
- Aggregate: `purchase-order.aggregate.ts`, `purchase-order.invariants.ts`
- Entity: `purchase-order-line.entity.ts`, `purchase-order-line.entity.invariants.ts`
- Events: created, submitted, approved, rejected, amended, issued, cancelled, completed, line-added, line-removed
- Factory: `purchase-order.factory.ts`
- Policies: `approval.policy.ts`, `cancellation.policy.ts`, `over-receipt.policy.ts`
- Services: `open-quantity.service.ts`, `purchase-order-approval.service.ts`, `purchase-order-pricing.service.ts`, `purchase-order-receipt.service.ts`, `purchase-order-status.service.ts`
- Repository port: `purchase-order-command.repository.ts`
- Value objects: `order-number.vo.ts` (+ invariants), `purchase-order-id.vo.ts`, `product-id-ref.vo.ts`, `vendor-id-ref.vo.ts`
- Types/enums: `purchase-order.enum.ts`, `purchase-order.types.ts`

Application:
- Use cases: create, update, amend, close, create (recurring), generate recurring, create recurring from PO, add/remove/update line, submit/approve/reject/issue/cancel/complete, list/get, get receipts, get remaining quantities, has receipts, import, register receipt, transition
- Facades: `purchase-order-for-grn.facade.ts`, `purchase-order-generation.facade.ts`
- Outbound ports: `approval-workflow.port.ts`, `budget-check.port.ts`, `company-config.port.ts`, `currency-rate.port.ts`, `numbering.port.ts`, `product-query.port.ts`, `read-cache.port.ts`, `supplier-network.port.ts`, `tax-calculation.port.ts`, `vendor-query.port.ts`
- Integrations listens: `goods-receipt-posted`, `vendor-bill-posted`, `recurring-occurrence-requested`
- Integrations publishes: `purchase-order.publisher-port.ts`, `purchase-order.released` publisher event
- Types: `recurring-occurrence.types.ts`
- Queries: `purchase-order.query.ts`

Infrastructure:
- Adapters (business-aggregate): `budget-check.adapter.ts`, `orderable-vendor.adapter.ts`, `purchasable-product.adapter.ts`, `vendor-eligibility.adapter.ts`
- Adapters (external): company-config, numbering, outbox, read-cache, tax-calculation, currency-rate, supplier-network, approval-workflow, product-query, vendor-query, read-cache
- Adapters (platform): import, recurring
- Persistence: `prisma-purchase-order-command.repository.ts`, `prisma-purchase-order-query.repository.ts`, `prisma-purchase-order.mapper.ts`

Endpoints (selected):
- `POST /purchase-orders`, `PATCH /purchase-orders/:id`
- `GET /purchase-orders`, `GET /purchase-orders/:id`
- `PATCH /purchase-orders/:id/lines`, `PATCH /purchase-orders/:id/lines/:productId`, `DELETE /purchase-orders/:id/lines/:productId`
- `PATCH /purchase-orders/:id/submit`, `approve`, `amend`, `reject`, `cancel`, `complete`, `issue`, `close`
- `POST /purchase-orders/recurring`, `POST /purchase-orders/:id/recurring`
- `GET /purchase-orders/:id/receipts`, `GET /purchase-orders/:id/remaining-quantities`

Public contracts/ports: `purchase-order-for-grn` (contract + port).

## Module: procurement/good-receipt-note

Aggregate: `GoodReceiptNote` (+ `GrnLine` entity).

Domain:
- Aggregate: `grn.aggregate.ts`, `grn.invariants.ts`
- Entity: `grn-line.entity.ts`, `grn-line.entity.invariants.ts`
- Events: created, received, completed, posted, cancelled, reversed, line-added
- Factory: `grn.factory.ts`
- Policies: `grn.invariants` covers quantity reconciliation; `received-quantity` VO invariants
- Value objects: `grn-number.invariants.ts`, `received-quantity.invariants.ts`, `grn-id.vo.ts`, `grn-line-id.vo.ts`

Application:
- Use cases: create, add-grn-line, cancel, complete, post, receive, reverse, update
- Facade: `grn-for-purchase-order.facade.ts`
- Outbound ports: `company-config.port.ts`, `numbering.port.ts`, `purchase-order-query.port.ts`, `read-cache.port.ts`
- Integrations publishes: `grn.publisher-port.ts`
- Queries: `grn.query.ts`

Infrastructure:
- Adapters (business-aggregate): `grn-for-purchase-order.adapter.ts`
- Adapters (external): company-config, numbering, purchase-order-query, read-cache, outbox
- Adapters (platform): import
- Persistence: `prisma-grn-command.repository.ts`, `prisma-grn-query.repository.ts`, `prisma-grn.mapper.ts`

Endpoints:
- `POST /goods-receipt-notes` (via controller `grn.controller.ts`)
- `GET /goods-receipt-notes`
- `GET /goods-receipt-notes/:id`
- `PATCH /goods-receipt-notes/:id/lines`
- `PATCH /goods-receipt-notes/:id/lines/:productId/tracking`
- `PATCH /goods-receipt-notes/:id/receive`
- `PATCH /goods-receipt-notes/:id/complete`
- `PATCH /goods-receipt-notes/:id/cancel`
- `PATCH /goods-receipt-notes/:id/inspection`
- `PATCH /goods-receipt-notes/:id/post`
- `PATCH /goods-receipt-notes/:id/reverse`

Public: `grn-for-purchase-order` contract + port.

## Module: sales/invoice

Aggregate: `Invoice`.

Domain:
- Aggregate: `invoice.aggregate.ts`, `invoice.invariants.ts`
- Events: `invoice.created`, `invoice.posted`
- Factory: `invoice.factory.ts`
- Value objects: `invoice-number.invariants.ts`, `invoice-id.vo.ts`, etc.
- Types: `invoice.enum.ts`, `invoice.types.ts`

Application:
- Use cases: `create-invoice.usecase.ts`, `post-invoice.usecase.ts`, `get-invoice.usecase.ts`, `list-invoices.usecase.ts`
- Outbound ports: `company-config.port.ts`, `numbering.port.ts`, `purchase-order-query.port.ts`? (check)
- Queries: `invoice.query.ts`

Infrastructure: adapters (company-config, numbering, outbox, read-cache), persistence prisma.

Endpoints:
- `POST /invoices`
- `GET /invoices`
- `GET /invoices/:id`
- `PATCH /invoices/:id/post`

## shared-business

Primitives under `src/business/shared-business`: domain entities/value objects, registries (invariant, policy), ports, utils. Framework-independent. Imported by business modules as `shared-business`.

## Implemented business rules (selected)

### Purchase order
- PO-06: controlled amendment of an issued order (spec §4) — `amend-purchase-order` use case + `purchase-order.amended` event.
- PO-07: receiving limit — over-receipt policy + concurrency-safe reservation (`register-purchase-order-receipt`).
- Optimistic concurrency on PurchaseOrder and GRN (`version`).
- Tenant/company scoping on `purchase_orders`.

### GRN
- Idempotent posting (`grn.post`) — outbox + idempotency.
- Concurrency: two concurrent receipts cannot jointly exceed over-receipt limit (e2e).
- Posted GRN immutable; reversal creates compensating movements.

### Tenancy
- All business tables carry `tenantId`/`companyId`; foreign row ⇒ 404.
- Document natural key unique within company (company-scoped numbering).

### Numbering
- Company-scoped sequences (`PO-00000001` per company).

### Events
- Outbox append inside `@Transactional()`; scheduler publishes; inbox dedupes consumers.
