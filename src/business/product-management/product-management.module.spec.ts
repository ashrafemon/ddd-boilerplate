import { MODULE_METADATA } from '@nestjs/common/constants';
import { ProductManagementModule } from './product-management.module';
jest.mock('@platform/platform.module', () => ({ PlatformModule: class PlatformModule {} }));

describe('ProductManagementModule', () => {
  it('imports its aggregate modules', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      ProductManagementModule,
    ) as unknown[];
    expect(imports.length).toBeGreaterThan(0);
  });
});
