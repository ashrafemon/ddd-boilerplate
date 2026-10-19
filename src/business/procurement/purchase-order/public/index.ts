/**
 * PurchaseOrder module's PUBLIC surface — the ONLY import path other modules
 * (currently GoodReceiptNote) may use. Everything else in this module —
 * domain, use cases, queries, infrastructure — is internal (ESLint-enforced).
 *
 * Contracts:
 * - `PurchaseOrderReference` — read shape of a PO for receiving validation
 *   (status/vendor/lines with the commercial snapshot).
 * - `PurchaseOrderReceiptRequest/Result` — atomic receipt registration
 *   (PO-07 balance, positive entries post, negative entries reverse).
 *
 * Implemented by `PurchaseOrderForGrnFacade` (`application/facades/`), which
 * delegates to the module's own use cases; consumers bind the abstract port
 * and reach it through the producer's exported Nest provider.
 */
export * from './contracts/purchase-order-for-grn.contract';
export * from './contracts/purchase-order-receipt.contract';
export * from './ports/purchase-order-for-grn.port';
