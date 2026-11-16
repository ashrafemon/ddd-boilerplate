import { MODULE_METADATA } from '@nestjs/common/constants';
import { PartyModule } from './party.module';
jest.mock('@platform/platform.module', () => ({ PlatformModule: class PlatformModule {} }));

describe('PartyModule', () => {
  it('imports its aggregate modules', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, PartyModule) as unknown[];
    expect(imports.length).toBeGreaterThan(0);
  });
});
