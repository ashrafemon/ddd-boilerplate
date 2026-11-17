import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { ImportHandlerRegistry } from './import-handler.registry';
import { IMPORT_OPT_IN_METADATA, ImportOptInMeta } from './import-opt-in';
import { discoverOptIns } from '@platform/platform-common/opt-in/discover-opt-ins';

/**
 * Scans the DI graph for `@ImportOptIn({entityKey, descriptor})` classes and
 * registers them on the registry at bootstrap. Replaces the old
 * composition-root bridge — adding an importable entity is now just
 * decorating its handler.
 */
@Injectable()
export class ImportOptInScanner implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly registry: ImportHandlerRegistry,
  ) {}

  public onApplicationBootstrap(): void {
    for (const { instance, meta } of discoverOptIns<ImportOptInMeta>(
      this.discovery,
      IMPORT_OPT_IN_METADATA,
    )) {
      this.registry.register(
        meta.entityKey,
        meta.descriptor,
        instance as Parameters<ImportHandlerRegistry['register']>[2],
      );
    }
  }
}
