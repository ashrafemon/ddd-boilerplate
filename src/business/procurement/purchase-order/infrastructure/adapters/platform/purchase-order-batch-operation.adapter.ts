import { Injectable } from '@nestjs/common';
import { BatchOperationHandler } from '@platform/platform-common/batch-operation/ports/batch-operation-handler.port';
import {
  ExecutionResult,
  ValidationResult,
} from '@platform/platform-common/batch-operation/batch-operation.types';
import { PurchaseOrderTransition } from '../../../domain/types/purchase-order.types';
import { GetPurchaseOrderUseCase } from '../../../application/use-cases/get-purchase-order.usecase';
import { SubmitPurchaseOrderUseCase } from '../../../application/use-cases/submit-purchase-order.usecase';
import { ApprovePurchaseOrderUseCase } from '../../../application/use-cases/approve-purchase-order.usecase';
import { RejectPurchaseOrderUseCase } from '../../../application/use-cases/reject-purchase-order.usecase';
import { CancelPurchaseOrderUseCase } from '../../../application/use-cases/cancel-purchase-order.usecase';

/**
 * PurchaseOrder's Batch Operation port — pure handler data + routing, no
 * lifecycle: the composition root (src/bootstrap/configure-batch-operations.ts)
 * registers it on the platform registry at boot, so generated adapters never
 * import platform implementation classes. A thin router: validate() pre-checks
 * the current status; execute() delegates to the semantic command use cases,
 * each inside its own @Transactional boundary — a PO moved via a batch is
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
    private readonly submitPurchaseOrder: SubmitPurchaseOrderUseCase,
    private readonly approvePurchaseOrder: ApprovePurchaseOrderUseCase,
    private readonly rejectPurchaseOrder: RejectPurchaseOrderUseCase,
    private readonly cancelPurchaseOrder: CancelPurchaseOrderUseCase,
  ) {}

  aggregateType(): string {
    return 'PurchaseOrder';
  }

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
    const reason = typeof params?.reason === 'string' ? params.reason : undefined;
    switch (operationCode) {
      case 'submit':
        await this.submitPurchaseOrder.execute(entityId);
        break;
      case 'approve':
        await this.approvePurchaseOrder.execute(entityId);
        break;
      case 'reject':
        await this.rejectPurchaseOrder.execute(entityId, reason ?? 'Rejected');
        break;
      case 'cancel':
        await this.cancelPurchaseOrder.execute(entityId);
        break;
    }
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
