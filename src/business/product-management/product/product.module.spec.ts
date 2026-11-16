import { MODULE_METADATA } from '@nestjs/common/constants';
import { ProductModule } from './product.module';
import { ProductController } from './presentation/http/product.controller';
import { CreateProductUseCase } from './application/use-cases/create-product.usecase';
jest.mock('@platform/platform.module', () => ({ PlatformModule: class PlatformModule {} }));

describe('ProductModule', () => {
  it('declares its controller and create use case', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ProductModule)).toContain(
      ProductController,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ProductModule)).toContain(
      CreateProductUseCase,
    );
  });
});
