/**
 * GoodReceiptNote module's PUBLIC surface — the ONLY import path other
 * modules may use. Everything else in this module is internal (ESLint-enforced).
 *
 * Contract: `GrnReference` — read shape of a GRN header + lines (status,
 * vendor, received quantities). Implemented by `GrnForPurchaseOrderFacade`
 * (`application/facades/`); reserved today for PurchaseOrder (cancellation
 * and receiving checks) and available to any future consumer through the
 * exported `GrnForPurchaseOrderPort` provider.
 */
export * from './contracts/grn-for-purchase-order.contract';
export * from './ports/grn-for-purchase-order.port';
