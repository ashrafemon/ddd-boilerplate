import { MODULE_METADATA } from '@nestjs/common/constants';
import { GoodReceiptNoteModule } from './purchase-goods-receipt.module';
import { GrnController } from './presentation/http/grn.controller';
import { CreateGrnUseCase } from './application/use-cases/create-grn.usecase';
jest.mock('@platform/platform.module', () => ({ PlatformModule: class PlatformModule {} }));

describe('GoodReceiptNoteModule', () => {
  it('declares its controller and create use case', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, GoodReceiptNoteModule)).toContain(
      GrnController,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, GoodReceiptNoteModule)).toContain(
      CreateGrnUseCase,
    );
  });
});
