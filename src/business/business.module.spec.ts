import { MODULE_METADATA } from '@nestjs/common/constants';
import { BusinessModule } from './business.module';
jest.mock('@platform/platform.module', () => ({ PlatformModule: class PlatformModule {} }));

describe('BusinessModule', () => {
  it('composes the bounded contexts', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, BusinessModule) as unknown[];
    expect(imports).toHaveLength(4);
  });
});
