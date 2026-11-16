import { MODULE_METADATA } from '@nestjs/common/constants';
import { ProcurementModule } from './procurement.module';
jest.mock('@platform/platform.module', () => ({ PlatformModule: class PlatformModule {} }));

describe('ProcurementModule', () => {
  it('imports its aggregate modules', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, ProcurementModule) as unknown[];
    expect(imports.length).toBeGreaterThan(0);
  });
});
