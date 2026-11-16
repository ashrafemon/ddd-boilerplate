import { MODULE_METADATA } from '@nestjs/common/constants';
import { PricingModule } from './pricing.module';
import { PriceListController } from './presentation/http/price-list.controller';
import { CreatePriceListUseCase } from './application/use-cases/create-price-list.usecase';
jest.mock('@platform/platform.module', () => ({ PlatformModule: class PlatformModule {} }));

describe('PricingModule', () => {
  it('declares its controller and create use case', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PricingModule)).toContain(
      PriceListController,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PricingModule)).toContain(
      CreatePriceListUseCase,
    );
  });
});
