import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { PurchaseOrderStatus } from '../types/purchase-order.types';

export interface CancellationCheck {
  status: PurchaseOrderStatus;
  hasReceipts: boolean;
}

/**
 * CancellationPolicy (plan Phase 2.4 / spec §7):
 *
 * A purchase order with POSTED receipts must not be cancelled — goods already
 * received against it need the return/reversal workflow, not a status flip.
 * `hasReceipts` is caller-supplied domain data computed from the PO's
 * authoritative receipt projection (plan Phase 3.3: PO owns the balance), so
 * the domain never reaches across the module boundary itself.
 */
policyRegistry.register<CancellationCheck>('purchase-order.cancellation', {
  name: 'purchase-order-cancellation-no-posted-receipts',
  evaluate: ({ hasReceipts }) => !hasReceipts,
});
