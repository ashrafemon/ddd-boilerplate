import { MODULE_METADATA } from '@nestjs/common/constants';
import { VendorModule } from './vendor.module';
import { VendorController } from './presentation/http/vendor.controller';
import { CreateVendorUseCase } from './application/use-cases/create-vendor.usecase';
jest.mock('@platform/platform.module', () => ({ PlatformModule: class PlatformModule {} }));

describe('VendorModule', () => {
  it('declares its controller and create use case', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, VendorModule)).toContain(
      VendorController,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, VendorModule)).toContain(
      CreateVendorUseCase,
    );
  });
});
