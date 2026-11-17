import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { BatchOperationHandlerRegistry } from './batch-operation-handler.registry';
import { BATCH_OPERATION_OPT_IN_METADATA } from './batch-operation-opt-in';
import { discoverOptIns } from '@platform/platform-common/opt-in/discover-opt-ins';

/**
 * Scans the DI graph for `@BatchOperationOptIn()` classes and registers them
 * on the registry at bootstrap. Replaces the old composition-root bridge —
 * adding a batch-capable aggregate is now just decorating its handler.
 */
@Injectable()
export class BatchOperationOptInScanner implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly registry: BatchOperationHandlerRegistry,
  ) {}

  public onApplicationBootstrap(): void {
    for (const { instance } of discoverOptIns<true>(
      this.discovery,
      BATCH_OPERATION_OPT_IN_METADATA,
    )) {
      this.registry.register(instance as Parameters<BatchOperationHandlerRegistry['register']>[0]);
    }
  }
}
