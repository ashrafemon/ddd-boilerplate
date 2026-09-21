import { INestApplicationContext, Type } from '@nestjs/common';
import { ImportHandlerRegistry } from '@platform/import/import-handler.registry';
import { ImportDescriptor } from '@platform/import/import.types';
import { ImportHandler } from '@platform/import/ports/import-handler.port';
import { VendorModule } from '@business/party/vendor/vendor.module';
import {
  VendorImportHandler,
  VENDOR_IMPORT_DESCRIPTOR,
} from '@business/party/vendor/infrastructure/adapters/platform/vendor-import.adapter';
import { PurchaseOrderModule } from '@business/procurement/purchase-order/purchase-order.module';
import {
  PurchaseOrderImportHandler,
  PURCHASE_ORDER_IMPORT_DESCRIPTOR,
} from '@business/procurement/purchase-order/infrastructure/adapters/platform/purchase-order-import.adapter';

/**
 * Composition-root bridge for the import opt-in — same precedent as
 * `configure-batch-operations.ts`: business handler adapters stay pure
 * (no lifecycle hooks, no registry imports), owner modules stay bodyless
 * `@Module`s, and only this file knows both sides. Adding an importable
 * entity = one row in `IMPORT_ENTITIES`; a duplicate entityKey still
 * throws at boot.
 */
export interface ImportEntityOptIn {
  entityKey: string;
  descriptor: ImportDescriptor;
  ownerModule: Type<unknown>;
  importHandler: Type<ImportHandler>;
}

export const IMPORT_ENTITIES: readonly ImportEntityOptIn[] = [
  {
    entityKey: 'vendor',
    descriptor: VENDOR_IMPORT_DESCRIPTOR,
    ownerModule: VendorModule,
    importHandler: VendorImportHandler,
  },
  {
    entityKey: 'purchase-order',
    descriptor: PURCHASE_ORDER_IMPORT_DESCRIPTOR,
    ownerModule: PurchaseOrderModule,
    importHandler: PurchaseOrderImportHandler,
  },
];

/** Strict per-module lookup: fails loudly if a module stops providing its adapter. */
export function configureImports(
  app: INestApplicationContext,
  entities: readonly ImportEntityOptIn[] = IMPORT_ENTITIES,
): void {
  const registry = app.get(ImportHandlerRegistry);
  for (const { entityKey, descriptor, ownerModule, importHandler } of entities) {
    registry.register(
      entityKey,
      descriptor,
      app.select(ownerModule).get(importHandler, { strict: true }),
    );
  }
}
