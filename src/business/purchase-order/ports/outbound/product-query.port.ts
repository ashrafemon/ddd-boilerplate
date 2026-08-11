/**
 * Outbound cross-module port consumed by PurchaseOrder. Typed against the
 * Product module's published inbound contract. PurchaseOrder never imports
 * Product repositories or Prisma.
 */
import type { ProductSummary } from '@business/product/ports/inbound/product.query.port';

export type ProductReference = ProductSummary;

export interface PurchasableProductQueryPort {
  getPurchasableProduct(id: string): Promise<ProductSummary | null>;
}

export const PURCHASE_ORDER_PRODUCT_PORT = Symbol('PURCHASE_ORDER_PRODUCT_PORT');
