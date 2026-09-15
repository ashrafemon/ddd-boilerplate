import { INestApplicationContext } from '@nestjs/common';
import { ImportHandlerRegistry } from '@platform/import/import-handler.registry';
import { ImportDescriptor } from '@platform/import/import.types';
import { ImportHandler } from '@platform/import/ports/import-handler.port';

// Same stubbing rationale as configure-batch-operations.spec.ts: keep this a
// unit test by not loading the real vendor module's HTTP/DI graph.
jest.mock('@business/party/vendor/vendor.module', () => ({
  VendorModule: class VendorModule {},
}));
jest.mock('@business/party/vendor/infrastructure/adapters/platform/vendor-import.adapter', () => ({
  VendorImportHandler: class VendorImportHandler {},
  VENDOR_IMPORT_DESCRIPTOR: { entityKey: 'vendor' },
}));

import { IMPORT_ENTITIES, configureImports } from './configure-imports';

class FakeOwnerModule {}

class FakeImportHandler implements ImportHandler {
  preloadReferences() {
    return Promise.resolve({});
  }
  validateBatch() {
    return Promise.resolve([]);
  }
  executeBatch() {
    return Promise.resolve([]);
  }
}

const fakeDescriptor = {
  entityKey: 'doc',
  version: 1,
  fields: [{ targetField: 'code', required: true }],
  upsertKeys: [['code']],
  maxRows: 100,
  maxFileSizeBytes: 1024,
  executionChunkSize: 10,
} as unknown as ImportDescriptor;

function fakeApp(registry: ImportHandlerRegistry, handler: ImportHandler) {
  return {
    get: (token: unknown) => (token === ImportHandlerRegistry ? registry : undefined),
    select: () => ({ get: () => handler }),
  } as unknown as INestApplicationContext;
}

describe('configureImports (composition-root bridge)', () => {
  it('plugs a pure business import handler into the platform registry', () => {
    const registry = new ImportHandlerRegistry();
    const handler = new FakeImportHandler();

    configureImports(fakeApp(registry, handler), [
      {
        entityKey: 'doc',
        descriptor: fakeDescriptor,
        ownerModule: FakeOwnerModule,
        importHandler: FakeImportHandler,
      },
    ]);

    expect(registry.health()).toEqual([
      { descriptorVersion: 1, fieldCount: 1, requiredFields: ['code'], entityKey: 'doc' },
    ]);
    expect(registry.resolveHandler('doc')).toBe(handler);
  });

  it('fails fast when two rows share an entityKey (template slip)', () => {
    const registry = new ImportHandlerRegistry();
    const app = fakeApp(registry, new FakeImportHandler());
    const optIn = {
      entityKey: 'doc',
      descriptor: fakeDescriptor,
      ownerModule: FakeOwnerModule,
      importHandler: FakeImportHandler,
    };

    expect(() => configureImports(app, [optIn, optIn])).toThrow(/already registered/);
  });

  it('default table covers exactly the importable aggregates', () => {
    expect(
      IMPORT_ENTITIES.map(
        ({
          entityKey,
          ownerModule,
          importHandler,
        }: {
          entityKey: string;
          ownerModule: { name: string };
          importHandler: { name: string };
        }) => [entityKey, ownerModule.name, importHandler.name],
      ),
    ).toEqual([['vendor', 'VendorModule', 'VendorImportHandler']]);
  });
});
