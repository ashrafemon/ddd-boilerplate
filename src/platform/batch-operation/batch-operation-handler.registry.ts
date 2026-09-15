import { BadRequestException, Injectable } from '@nestjs/common';
import { KeyedRegistryBase } from '@shared-kernel/utils/keyed-registry.base';
import { BatchOperationHandler } from './ports/batch-operation-handler.port';

interface RegisteredEntry {
  aggregateType: string;
  supportedOperations: string[];
  handler: BatchOperationHandler;
}

/**
 * Map<aggregateType, handler>, resolved by string key at runtime — the same
 * service-locator pattern as ScheduledJobHandlerRegistry. Populated at
 * bootstrap by the owning aggregate's BatchOperationHandler adapter itself
 * (self-registration — no business-module class code); every
 * pipeline component (Service / Worker) resolves through this and never
 * branches on aggregateType or operationCode itself.
 */
@Injectable()
export class BatchOperationHandlerRegistry extends KeyedRegistryBase<RegisteredEntry> {
  /**
   * Called once per handler at boot; every field of the entry comes from the
   * handler itself (`aggregateType()` / `supportedOperations()`) so there is
   * no second registration source to drift from. A duplicate aggregateType
   * throws here, not on the first row that hits it.
   */
  register(handler: BatchOperationHandler): void {
    const aggregateType = handler.aggregateType();
    if (this.has(aggregateType)) {
      throw new Error(
        `BatchOperationHandler for aggregateType '${aggregateType}' already registered`,
      );
    }

    this.entries.set(aggregateType, {
      aggregateType,
      supportedOperations: handler.supportedOperations(),
      handler,
    });
  }

  resolveHandler(aggregateType: string): BatchOperationHandler {
    return this.requireEntry(
      aggregateType,
      () => new Error(`No BatchOperationHandler registered for aggregateType '${aggregateType}'`),
    ).handler;
  }

  assertOperationSupported(aggregateType: string, operationCode: string): void {
    const entry = this.requireEntry(
      aggregateType,
      () => new Error(`No BatchOperationHandler registered for aggregateType '${aggregateType}'`),
    );
    if (!entry.supportedOperations.includes(operationCode)) {
      throw new BadRequestException(
        `aggregateType '${aggregateType}' does not support operationCode '${operationCode}'`,
      );
    }
  }

  /** Health indicator — makes "why can't I bulk-cancel Bills" a five-second diagnosis. */
  health(): Array<{ aggregateType: string; supportedOperations: string[] }> {
    return [...this.entries.values()].map(({ aggregateType, supportedOperations }) => ({
      aggregateType,
      supportedOperations: [...supportedOperations],
    }));
  }
}
