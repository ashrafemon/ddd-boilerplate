# API Endpoints — Implemented

Base path: `/api/v1` (see `src/config`). Swagger: `/api/docs`.

## Business endpoints

### Products (`/products`)
- `POST /products`
- `GET /products`
- `GET /products/:id`
- `PATCH /products/:id`
- `PATCH /products/:id/change-price`
- `PATCH /products/:id/activate`
- `PATCH /products/:id/deactivate`
- `PATCH /products/:id/discontinue`

### Vendors (`/vendors`)
- `POST /vendors`
- `GET /vendors`
- `GET /vendors/:id`
- `PATCH /vendors/:id`
- `PATCH /vendors/:id/activate`
- `PATCH /vendors/:id/deactivate`
- `PATCH /vendors/:id/block`

### Purchase Orders (`/purchase-orders`)
- `POST /purchase-orders`
- `PATCH /purchase-orders/:id`
- `GET /purchase-orders`
- `GET /purchase-orders/:id`
- `PATCH /purchase-orders/:id/lines`
- `PATCH /purchase-orders/:id/lines/:productId`
- `DELETE /purchase-orders/:id/lines/:productId`
- `PATCH /purchase-orders/:id/submit`
- `PATCH /purchase-orders/:id/approve`
- `PATCH /purchase-orders/:id/amend`
- `PATCH /purchase-orders/:id/reject`
- `PATCH /purchase-orders/:id/cancel`
- `PATCH /purchase-orders/:id/complete`
- `PATCH /purchase-orders/:id/issue`
- `PATCH /purchase-orders/:id/close`
- `POST /purchase-orders/recurring`
- `POST /purchase-orders/:id/recurring`
- `GET /purchase-orders/:id/receipts`
- `GET /purchase-orders/:id/remaining-quantities`

### Goods Receipt Notes (`/goods-receipt-notes`)
- `POST /goods-receipt-notes`
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

### Invoices (`/invoices`)
- `POST /invoices`
- `GET /invoices`
- `GET /invoices/:id`
- `PATCH /invoices/:id/post`

## Platform endpoints

- `GET /api/v1/metrics` (`@SkipTenancy()`) — Prometheus exposition.
- `/import/*` — bulk import jobs.
- `/scheduler/*` — admin scheduled jobs.
- `/recurring/*` — recurring templates.
- `/notification/*` — send/track notifications.
- `/batch-operation/*` — bulk operations.
- `/webhooks/inbound/:source` — inbound webhooks.
- `/webhooks/*` — outbound subscription management.

See respective platform service READMEs for full route lists.
