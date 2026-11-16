import { MODULE_METADATA } from '@nestjs/common/constants';
import { PurchaseOrderModule } from './purchase-order.module';
import { PurchaseOrderController } from './presentation/http/purchase-order.controller';
import { CreatePurchaseOrderUseCase } from './application/use-cases/create-purchase-order.usecase';
jest.mock('@platform/platform.module', () => ({ PlatformModule: class PlatformModule {} }));

describe('PurchaseOrderModule', () => {
  it('declares its controller and create use case', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PurchaseOrderModule)).toContain(
      PurchaseOrderController,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PurchaseOrderModule)).toContain(
      CreatePurchaseOrderUseCase,
    );
  });
});
