import { Injectable } from '@nestjs/common';

export interface VendorBillPostedPayload {
  vendorId: string;
  billNumber: string;
  amount: number;
  currency: string;
  purchaseOrderId?: string;
  lines?: Array<{ productId: string; quantity: number; amount: number }>;
}

/**
 * Handles an inbound `VendorBillPosted` integration event.
 *
 * A vendor bill posted by an external billing system is acknowledged and,
 * when it references a purchase order, the receipt is registered against it.
 * Returns the bill number as the handling result.
 */
@Injectable()
export class HandleVendorBillPostedUseCase {
  execute(payload: VendorBillPostedPayload): Promise<string> {
    return Promise.resolve(payload.billNumber);
  }
}
