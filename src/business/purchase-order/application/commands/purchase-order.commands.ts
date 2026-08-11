import {
  AddLineInput,
  CreatePurchaseOrderInput,
  PurchaseOrderIdInput,
  RejectInput,
  RemoveLineInput,
} from '../../ports/inbound/purchase-order.command.port';

export class CreatePurchaseOrderCommand implements CreatePurchaseOrderInput {
  constructor(
    public readonly vendorId: string,
    public readonly currency: string | undefined,
  ) {}
}

export class AddPurchaseOrderLineCommand implements AddLineInput {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly currency: string | undefined,
  ) {}
}

export class RemovePurchaseOrderLineCommand implements RemoveLineInput {
  constructor(
    public readonly id: string,
    public readonly productId: string,
  ) {}
}

export class SubmitPurchaseOrderCommand implements PurchaseOrderIdInput {
  constructor(public readonly id: string) {}
}

export class ApprovePurchaseOrderCommand implements PurchaseOrderIdInput {
  constructor(public readonly id: string) {}
}

export class RejectPurchaseOrderCommand implements RejectInput {
  constructor(
    public readonly id: string,
    public readonly reason: string,
  ) {}
}

export class CancelPurchaseOrderCommand implements PurchaseOrderIdInput {
  constructor(public readonly id: string) {}
}

export class CompletePurchaseOrderCommand implements PurchaseOrderIdInput {
  constructor(public readonly id: string) {}
}
