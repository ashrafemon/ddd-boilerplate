# ERP Boilerplate — API Endpoints

This document describes the HTTP API structure, controllers, DTOs, response envelopes, and
versioning.

## API versioning

URI versioning with default `v1` → all endpoints under `/api/v1`.

## Global prefix

`api` → base path is `/api/v1`.

## Response envelope

All successful responses follow the standard envelope:

```ts
{
  status: string;       // e.g. 'success'
  statusCode: number;   // e.g. 200
  data: unknown;        // response payload
  message: string;      // human-readable message
}
```

Error responses follow the `HttpExceptionsFilter` envelope (validation/HTTP/statusCode-tagged
errors → standard error envelope).

## Device-aware responses

One controller produces two response shapes selected by the `x-device-type` header:

| Header value | Response DTO |
|--------------|--------------|
| `web` | Full payload (all fields) |
| `mobile` | Minimal payload (essential fields only) |

Validated with Zod via `createZodDto`. The `DeviceResponseInterceptor` reads
`x-device-type` into CLS and maps `data` through the DTO class chosen by `@DeviceResponse`.

## Request validation

`AppValidationPipe` (extends nestjs-zod `ZodValidationPipe`; global `APP_PIPE`) validates
all request bodies against Zod schemas defined in `http/requests/*.request.dto.ts`.

One request DTO per file.

## Controllers

Controllers are **thin** — they inject use cases, call `execute`, and return
`{data, message}`. No inline existence checks, date mapping, or business logic.

## Endpoint reference

### Products (`/api/v1/products`)

| Method | Path | Description | Body DTO |
|--------|------|-------------|----------|
| `POST` | `/products` | Create a product | `CreateProductRequestDto` |
| `GET` | `/products` | List products | `QueryProductsRequestDto` |
| `GET` | `/products/:id` | Get a product | — |
| `PATCH` | `/products/:id` | Update a product | `UpdateProductRequestDto` |
| `PATCH` | `/products/:id/price` | Change product price | — |
| `PATCH` | `/products/:id/status` | Change product status | `ProductStatusRequestDto` |

### Vendors (`/api/v1/vendors`)

| Method | Path | Description | Body DTO |
|--------|------|-------------|----------|
| `POST` | `/vendors` | Create a vendor | `CreateVendorRequestDto` |
| `GET` | `/vendors` | List vendors | `QueryVendorsRequestDto` |
| `GET` | `/vendors/:id` | Get a vendor | — |
| `PATCH` | `/vendors/:id` | Update a vendor | `UpdateVendorRequestDto` |
| `PATCH` | `/vendors/:id/status` | Change vendor status | `VendorStatusRequestDto` |

### Purchase Orders (`/api/v1/purchase-orders`)

| Method | Path | Description | Body DTO |
|--------|------|-------------|----------|
| `POST` | `/purchase-orders` | Create a purchase order | `CreatePurchaseOrderRequestDto` |
| `GET` | `/purchase-orders` | List purchase orders | — |
| `GET` | `/purchase-orders/:id` | Get a purchase order | — |
| `POST` | `/purchase-orders/:id/lines` | Add a line | `AddLineRequestDto` |
| `PATCH` | `/purchase-orders/:id/lines/:productId` | Update a line | `UpdatePurchaseOrderLineRequestDto` |
| `DELETE` | `/purchase-orders/:id/lines/:productId` | Remove a line | `RemoveLineRequestDto` |
| `POST` | `/purchase-orders/:id/submit` | Submit for approval | — |
| `POST` | `/purchase-orders/:id/approve` | Approve the order | — |
| `POST` | `/purchase-orders/:id/reject` | Reject the order | — |
| `POST` | `/purchase-orders/:id/cancel` | Cancel the order | — |
| `POST` | `/purchase-orders/:id/issue` | Issue the order | — |
| `POST` | `/purchase-orders/:id/close` | Close/complete the order | — |
| `POST` | `/purchase-orders/:id/receive` | Register receipt | `PurchaseOrderReceiptRequestDto` |

### Good Receipt Notes (`/api/v1/grn`)

| Method | Path | Description | Body DTO |
|--------|------|-------------|----------|
| `POST` | `/grn` | Create a GRN | `CreateGrnRequestDto` |
| `GET` | `/grn` | List GRNs | — |
| `GET` | `/grn/:id` | Get a GRN | — |
| `POST` | `/grn/:id/post` | Post the GRN | — |
| `POST` | `/grn/:id/reverse` | Reverse the GRN | — |
| `POST` | `/grn/:id/receive` | Receive the GRN | — |
| `POST` | `/grn/:id/cancel` | Cancel the GRN | — |

### Invoices (`/api/v1/invoices`)

| Method | Path | Description | Body DTO |
|--------|------|-------------|----------|
| `POST` | `/invoices` | Create an invoice | `CreateInvoiceRequestDto` |
| `GET` | `/invoices` | List invoices | — |
| `GET` | `/invoices/:id` | Get an invoice | — |
| `POST` | `/invoices/:id/post` | Post the invoice | — |

## Example calls

```bash
# Create a product
curl -X POST http://localhost:4000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-100","name":"Wireless Mouse","unitPrice":19.99,"currency":"USD"}'

# Create a vendor
curl -X POST http://localhost:4000/api/v1/vendors \
  -H "Content-Type: application/json" \
  -d '{"code":"VEN-100","name":"Acme Supplies","email":"billing@acme.com"}'

# Create a purchase order
curl -X POST http://localhost:4000/api/v1/purchase-orders \
  -H "Content-Type: application/json" \
  -d '{"vendorId":"<vendor-id>"}'

# Add a line
curl -X POST http://localhost:4000/api/v1/purchase-orders/<po-id>/lines \
  -H "Content-Type: application/json" \
  -d '{"productId":"<product-id>","quantity":3,"unitPrice":19.99}'

# Submit (ABAC evaluated from CLS context)
curl -X POST http://localhost:4000/api/v1/purchase-orders/<po-id>/submit \
  -H "x-tenant-id: <tenant-id>" \
  -H "x-company-id: <company-id>" \
  -H "x-user-id: <user-id>"
```

## Swagger

- URL: `http://localhost:4000/api/docs`
- Disabled in production

## Health / Metrics

- `GET /api/v1/metrics` — Prometheus metrics (`@SkipTenancy()` route, no auth required)
- `GET /api/v1/health` — health check
