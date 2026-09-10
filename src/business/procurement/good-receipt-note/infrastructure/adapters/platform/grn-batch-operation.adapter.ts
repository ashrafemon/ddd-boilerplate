import { Injectable } from '@nestjs/common';
import { BatchOperationHandler } from '@platform/batch-operation/ports/batch-operation-handler.port';
import { ExecutionResult, ValidationResult } from '@platform/batch-operation/batch-operation.types';
import { CompleteGrnUseCase } from '../../../application/usecases/complete-grn.usecase';
import { GetGrnUseCase } from '../../../application/usecases/get-grn.usecase';
import { ReceiveGrnUseCase } from '../../../application/usecases/receive-grn.usecase';

export type GrnBatchOperation = 'receive' | 'complete';

const OPERATIONS: GrnBatchOperation[] = ['receive', 'complete'];

const ALLOWED_FROM: Record<string, string[]> = {
  receive: ['DRAFT'],
  complete: ['RECEIVED'],
};

/**
 * GoodReceiptNote's Batch Operation port — thin router onto the module's own
 * single-record use cases (receive / complete), each running inside its own
 * @Transactional boundary.
 */
@Injectable()
export class GrnBatchOperationAdapter implements BatchOperationHandler {
  constructor(
    private readonly getGrn: GetGrnUseCase,
    private readonly receiveGrn: ReceiveGrnUseCase,
    private readonly completeGrn: CompleteGrnUseCase,
  ) {}

  supportedOperations(): string[] {
    return [...OPERATIONS];
  }

  async validate(entityId: string, operationCode: string): Promise<ValidationResult> {
    const grn = await this.getGrn.execute(entityId);
    if (!grn) {
      return { canProceed: false, reason: 'Goods receipt not found' };
    }
    const allowed = ALLOWED_FROM[operationCode] ?? [];
    if (!allowed.includes(grn.status)) {
      return {
        canProceed: false,
        reason: `ALREADY_IN_TARGET_STATE: cannot ${operationCode} a ${grn.status} goods receipt`,
      };
    }
    return { canProceed: true };
  }

  async execute(entityId: string, operationCode: string): Promise<ExecutionResult> {
    const before = await this.getGrn.execute(entityId);
    if (operationCode === 'receive') {
      await this.receiveGrn.execute({ id: entityId });
    } else if (operationCode === 'complete') {
      await this.completeGrn.execute(entityId);
    } else {
      throw new Error(`Unsupported GRN batch operation '${operationCode}'`);
    }
    const after = await this.getGrn.execute(entityId);
    return {
      resultSnapshot: {
        transition: operationCode,
        statusBefore: before?.status ?? null,
        statusAfter: after?.status ?? null,
      },
    };
  }
}
