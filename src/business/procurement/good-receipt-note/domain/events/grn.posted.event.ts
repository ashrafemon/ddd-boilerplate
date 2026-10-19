import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

export class GoodsReceiptPosted extends DomainEvent {
  constructor(
    public readonly grnId: string,
    public readonly purchaseOrderId: string,
    public readonly lines: Array<{
      grnLineId: string;
      productId: string;
      acceptedQuantity: number;
      unitPrice: number;
    }>,
  ) {
    super();
  }
}
