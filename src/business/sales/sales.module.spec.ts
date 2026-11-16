import { MODULE_METADATA } from '@nestjs/common/constants';
import { SalesModule } from './sales.module';
jest.mock('@platform/platform.module', () => ({ PlatformModule: class PlatformModule {} }));

describe('SalesModule', () => {
  it('imports its aggregate modules', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, SalesModule) as unknown[];
    expect(imports.length).toBeGreaterThan(0);
  });
});
