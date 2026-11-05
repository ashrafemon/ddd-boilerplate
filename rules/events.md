# Events — Implemented

Domain events are persisted to the transactional outbox (`outbox_messages`)
inside the caller's `@Transactional()` and published asynchronously by the
scheduler/outbox dispatcher. Consumers dedupe via inbox.

## Business domain events

### Vendor (`party/vendor`)
- `vendor.created`
- `vendor.updated`
- `vendor.activated`
- `vendor.deactivated`
- `vendor.blocked`

### Product (`procurement/product`)
- `product.created`
- `product.updated`
- `product.activated`
- `product.deactivated`
- `product.discontinued`

### Purchase Order (`procurement/purchase-order`)
- `purchase-order.created`
- `purchase-order.submitted`
- `purchase-order.approved`
- `purchase-order.rejected`
- `purchase-order.amended`
- `purchase-order.issued`
- `purchase-order.cancelled`
- `purchase-order.completed`
- `purchase-order.line-added`
- `purchase-order.line-removed`

### Good Receipt Note (`procurement/good-receipt-note`)
- `grn.created`
- `grn.received`
- `grn.completed`
- `grn.posted`
- `grn.cancelled`
- `grn.reversed`
- `grn.line-added`

### Invoice (`sales/invoice`)
- `invoice.created`
- `invoice.posted`

## Listeners (incoming)

Purchase order listens to:
- `goods-receipt-posted`
- `vendor-bill-posted`
- `recurring-occurrence-requested`

## Platform events

- Import: `ImportJobCompleted`, `ImportJobFailed`, `ImportJobCancelled`
- Recurring: `RecurringOccurrenceRequested`
- Outbox: claim/publish/retry/dead-letter lifecycle
- Saga: instance step events
- Notification: delivery receipts

## Transport

- Envelope carries `eventId`, `correlationId`, `causationId`, `tenantId`,
  `companyId`, payload.
- Broker routing via `MessageQueuePort` on `envelope.broker`
  (rabbitmq default, kafka, sqs).
- In-process listeners use `@OnEvent('<EventType>')` over the canonical envelope.
