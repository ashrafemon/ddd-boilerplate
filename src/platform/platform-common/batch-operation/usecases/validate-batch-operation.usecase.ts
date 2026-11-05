import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { BatchOperationHandlerRegistry } from '../batch-operation-handler.registry';
import {
  BatchOperationContext,
  BatchOperationPreview,
  BatchOperationPreviewItem,
  ValidateBatchOperationInput,
} from '../batch-operation.types';

/**
 * PHASE 1 dry run. Resolves the handler and calls validate() for every
 * entityId — read-only, no job exists yet. Same validate() the real run calls
 * per row, so the preview never lies.
 */
@Injectable()
export class ValidateBatchOperationUseCase {
  constructor(
    private readonly registry: BatchOperationHandlerRegistry,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(input: ValidateBatchOperationInput): Promise<BatchOperationPreview> {
    const handler = this.registry.resolveHandler(input.aggregateType);
    this.registry.assertOperationSupported(input.aggregateType, input.operationCode);

    const entityIds = [...new Set(input.entityIds.filter(id => id && id.trim().length > 0))];
    const context: BatchOperationContext = {
      tenantId: input.tenantId ?? this.requestContext.getTenantId(),
      batchOperationJobId: `preview-${randomUUID()}`,
    };

    const items: BatchOperationPreviewItem[] = [];
    for (const entityId of entityIds) {
      try {
        const verdict = await handler.validate(
          entityId,
          input.operationCode,
          input.params,
          context,
        );
        items.push({ entityId, canProceed: verdict.canProceed, reason: verdict.reason });
      } catch (err) {
        items.push({
          entityId,
          canProceed: false,
          reason: FailureMessage.of(err),
        });
      }
    }

    const wouldProceed = items.filter(item => item.canProceed).length;
    return {
      canProceed: items.length > 0 && wouldProceed === items.length,
      total: items.length,
      wouldProceed,
      wouldFail: items.length - wouldProceed,
      items,
    };
  }
}
