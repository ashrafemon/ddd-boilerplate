/**
 * Receipt-registration contract (plan Phase 3.3) — PO owns the receiving
 * balance, GRN owns the document. PRODUCER-OWNED: the PurchaseOrder module
 * defines and implements it; the GRN module consumes it through its
 * `application/outbound-ports/purchase-order-query.port.ts` + module adapter.
 *
 * Semantics guaranteed by `registerReceipt` (all inside the caller's CLS
 * transaction):
 * - PO lines are locked `FOR UPDATE`, so concurrent registrations serialize —
 *   two receipts can never jointly exceed the PO-07 tolerance limit.
 * - `receivedQuantity > 0` = a post (balance grows), `< 0` = a reversal
 *   compensation (balance returns); the over-receipt policy only bounds the
 *   upper side, so a mirror can never exceed what its original registered.
 * - Unknown product on the PO ⇒ 404, tolerance breach ⇒ 422 — never a
 *   silent partial write.
 */
export interface PurchaseOrderReceiptLine {
  productId: string;
  /** Positive to receive, negative to reverse (compensating entry). */
  receivedQuantity: number;
}

export interface PurchaseOrderReceiptRequest {
  purchaseOrderId: string;
  lines: PurchaseOrderReceiptLine[];
  actorId?: string;
}

export interface PurchaseOrderReceiptResult {
  purchaseOrderId: string;
  receiptStatus: 'NOT_RECEIVED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED';
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
  }[];
}
