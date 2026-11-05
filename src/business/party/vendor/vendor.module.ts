import { Module } from '@nestjs/common';
import { VendorImportHandler } from './infrastructure/adapters/platform/vendor-import.adapter';
import { PlatformModule } from '@platform/platform.module';
import { VendorForPurchaseFacade } from './application/facades/vendor-for-purchase.facade';
import { VendorPublisherPort } from './application/integrations/publishes/vendor.publisher-port';
import { CreateVendorUseCase } from './application/usecases/create-vendor.usecase';
import { GetOrderableVendorUseCase } from './application/usecases/get-orderable-vendor.usecase';
import { FindOrderableVendorsByCodesUseCase } from './application/usecases/find-orderable-vendors-by-codes.usecase';
import { GetVendorUseCase } from './application/usecases/get-vendor.usecase';
import { ListVendorsUseCase } from './application/usecases/list-vendors.usecase';
import { UpdateVendorUseCase } from './application/usecases/update-vendor.usecase';
import { VendorStatusUseCase } from './application/usecases/vendor-status.usecase';
import { VendorCommandRepository } from './domain/repositories/vendor-command.repository';
import { VendorQuery } from './application/queries/vendor.query';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import { PrismaVendorCommandRepository } from './infrastructure/persistence/prisma/prisma-vendor-command.repository';
import { PrismaVendorQueryRepository } from './infrastructure/persistence/prisma/prisma-vendor-query.repository';
import { VendorController } from './presentation/http/vendor.controller';
import { VendorForPurchasePort } from '@business/party/vendor/public/ports/vendor-for-purchase.port';

/**
 * Vendor aggregate module. The import opt-in handler is registered by the
 * composition-root bridge (`src/bootstrap/configure-imports.ts`) — this
 * module carries no lifecycle.
 *
 * Command usecases now read company configuration from the global CLS
 * `RequestContext` (stamped by middleware) instead of injecting
 * `CompanyConfigPort` directly (Rule 8).
 */
@Module({
  imports: [PlatformModule],
  controllers: [VendorController],
  providers: [
    VendorImportHandler,
    CreateVendorUseCase,
    UpdateVendorUseCase,
    VendorStatusUseCase,
    GetVendorUseCase,
    ListVendorsUseCase,
    GetOrderableVendorUseCase,
    FindOrderableVendorsByCodesUseCase,
    VendorForPurchaseFacade,
    { provide: VendorForPurchasePort, useExisting: VendorForPurchaseFacade },
    { provide: VendorCommandRepository, useClass: PrismaVendorCommandRepository },
    { provide: VendorQuery, useClass: PrismaVendorQueryRepository },
    { provide: VendorPublisherPort, useClass: OutboxAdapter },
  ],
  exports: [VendorForPurchasePort],
})
export class VendorModule {}
