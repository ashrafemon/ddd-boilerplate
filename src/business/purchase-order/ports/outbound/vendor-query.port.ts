/**
 * Outbound cross-module port consumed by PurchaseOrder. Typed against the
 * Vendor module's published inbound contract so `useExisting` wiring is
 * structural. PurchaseOrder never imports Vendor repositories or Prisma.
 */
import type {
  VendorQueryPort,
  VendorSummary,
} from '@business/vendor/ports/inbound/vendor.query.port';
import { VendorId } from '@business/vendor/domain/value-objects/vendor-id.vo';

export type VendorReference = VendorSummary;
export type { VendorQueryPort };

export interface OrderableVendorQueryPort {
  getOrderableVendor(id: string): Promise<VendorSummary | null>;
}

export const PURCHASE_ORDER_VENDOR_PORT = Symbol('PURCHASE_ORDER_VENDOR_PORT');

export { VendorId };
