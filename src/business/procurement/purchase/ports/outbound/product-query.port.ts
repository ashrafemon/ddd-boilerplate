/**
 * Outbound cross-module port consumed by PurchaseOrder. Typed against a local
 * structural reference shape. PurchaseOrder never imports the Product module —
 * the adapter resolves the product query use case through the ModuleRef and
 * delegates to it.
 */
export interface ProductReference {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  status: string;
  unitPrice: number;
  currency: string;
}

export interface PurchasableProductQueryPort {
  getPurchasableProduct(id: string): Promise<ProductReference | null>;
}

export const PURCHASE_ORDER_PRODUCT_PORT = Symbol('PURCHASE_ORDER_PRODUCT_PORT');
