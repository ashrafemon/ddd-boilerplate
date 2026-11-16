import { MODULE_METADATA } from '@nestjs/common/constants';
import { InvoiceModule } from './invoice.module';
import { InvoiceController } from './presentation/http/invoice.controller';
import { CreateInvoiceUseCase } from './application/use-cases/create-invoice.usecase';
jest.mock('@platform/platform.module', () => ({ PlatformModule: class PlatformModule {} }));

describe('InvoiceModule', () => {
  it('declares its controller and create use case', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, InvoiceModule)).toContain(
      InvoiceController,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, InvoiceModule)).toContain(
      CreateInvoiceUseCase,
    );
  });
});
