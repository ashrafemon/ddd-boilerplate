import { Injectable } from '@nestjs/common';
import { BatchOperationHandler } from '@platform/batch-operation/ports/batch-operation-handler.port';
import { ExecutionResult, ValidationResult } from '@platform/batch-operation/batch-operation.types';
import { PurchaseOrderTransition } from '../../../domain/types/purchase-order.types';
import { GetPurchaseOrderUseCase } from '../../../application/usecases/get-purchase-order.usecase';
import { PurchaseOrderTransitionUseCase } from '../../../application/usecases/purchase-order-transition.usecase';

/**
 * PurchaseOrder's Batch Operation port. A thin router: validate() pre-checks
 * the current status; execute() delegates to the same
 * PurchaseOrderTransitionUseCase a single-record UI click would call, inside
 * that use case's own @Transactional boundary — a PO moved via a batch is
 * indistinguishable from one moved by hand.
 */
const OPERATIONS: PurchaseOrderTransition[] = ['submit', 'approve', 'reject', 'cancel'];

const ALLOWED_FROM: Record<string, string[]> = {
  submit: ['DRAFT'],
  approve: ['SUBMITTED'],
  reject: ['SUBMITTED'],
  cancel: ['DRAFT', 'SUBMITTED', 'APPROVED'],
};

@Injectable()
export class PurchaseOrderBatchOperationAdapter implements BatchOperationHandler {
  constructor(
    private readonly getPurchaseOrder: GetPurchaseOrderUseCase,
    private readonly transitionPurchaseOrder: PurchaseOrderTransitionUseCase,
  ) {}

  supportedOperations(): string[] {
    return [...OPERATIONS];
  }

  async validate(entityId: string, operationCode: string): Promise<ValidationResult> {
    const po = await this.getPurchaseOrder.execute(entityId);
    if (!po) {
      return { canProceed: false, reason: 'Purchase order not found' };
    }
    const allowed = ALLOWED_FROM[operationCode] ?? [];
    if (!allowed.includes(po.status)) {
      return {
        canProceed: false,
        reason: `ALREADY_IN_TARGET_STATE: cannot ${operationCode} a ${po.status} purchase order`,
      };
    }
    return { canProceed: true };
  }

  async execute(
    entityId: string,
    operationCode: string,
    params: Record<string, unknown> | undefined,
  ): Promise<ExecutionResult> {
    const before = await this.getPurchaseOrder.execute(entityId);
    await this.transitionPurchaseOrder.execute({
      id: entityId,
      transition: operationCode as PurchaseOrderTransition,
      reason: typeof params?.reason === 'string' ? params.reason : undefined,
    });
    const after = await this.getPurchaseOrder.execute(entityId);
    return {
      resultSnapshot: {
        transition: operationCode,
        statusBefore: before?.status ?? null,
        statusAfter: after?.status ?? null,
      },
    };
  }
}
