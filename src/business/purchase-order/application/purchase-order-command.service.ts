import { Injectable } from '@nestjs/common';
import {
  AddLineInput,
  CreatePurchaseOrderInput,
  PurchaseOrderCommandPort,
  PurchaseOrderIdInput,
  RejectInput,
  RemoveLineInput,
} from '../ports/inbound/purchase-order.command.port';
import { CreatePurchaseOrderUseCase } from './use-cases/create-purchase-order.use-case';
import { AddPurchaseOrderLineUseCase } from './use-cases/add-purchase-order-line.use-case';
import { RemovePurchaseOrderLineUseCase } from './use-cases/remove-purchase-order-line.use-case';
import { PurchaseOrderTransitionUseCase } from './use-cases/purchase-order-transition.use-case';
import { PurchaseOrderId } from '../domain/value-objects/purchase-order-id.vo';

@Injectable()
export class PurchaseOrderCommandService implements PurchaseOrderCommandPort {
  constructor(
    private readonly createPurchaseOrderUseCase: CreatePurchaseOrderUseCase,
    private readonly addPurchaseOrderLineUseCase: AddPurchaseOrderLineUseCase,
    private readonly removePurchaseOrderLineUseCase: RemovePurchaseOrderLineUseCase,
    private readonly transitionUseCase: PurchaseOrderTransitionUseCase,
  ) {}

  createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderId> {
    return this.createPurchaseOrderUseCase.execute(input);
  }

  addLine(input: AddLineInput): Promise<PurchaseOrderId> {
    return this.addPurchaseOrderLineUseCase.execute(input);
  }

  removeLine(input: RemoveLineInput): Promise<PurchaseOrderId> {
    return this.removePurchaseOrderLineUseCase.execute(input);
  }

  submit(input: PurchaseOrderIdInput): Promise<PurchaseOrderId> {
    return this.transitionUseCase.execute(input, 'submit');
  }

  approve(input: PurchaseOrderIdInput): Promise<PurchaseOrderId> {
    return this.transitionUseCase.execute(input, 'approve');
  }

  reject(input: RejectInput): Promise<PurchaseOrderId> {
    return this.transitionUseCase.execute(input, 'reject');
  }

  cancel(input: PurchaseOrderIdInput): Promise<PurchaseOrderId> {
    return this.transitionUseCase.execute(input, 'cancel');
  }

  complete(input: PurchaseOrderIdInput): Promise<PurchaseOrderId> {
    return this.transitionUseCase.execute(input, 'complete');
  }
}
