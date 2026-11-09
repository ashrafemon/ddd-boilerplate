import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { PriceListController } from './presentation/http/price-list.controller';
import { CreatePriceListUseCase } from './application/use-cases/create-price-list.usecase';
import { UpdatePriceListUseCase } from './application/use-cases/update-price-list.usecase';
import { AddPriceListLineUseCase } from './application/use-cases/add-price-list-line.usecase';
import { RemovePriceListLineUseCase } from './application/use-cases/remove-price-list-line.usecase';
import { ActivatePriceListUseCase } from './application/use-cases/activate-price-list.usecase';
import { DeactivatePriceListUseCase } from './application/use-cases/deactivate-price-list.usecase';
import { ArchivePriceListUseCase } from './application/use-cases/archive-price-list.usecase';
import { GetProductPriceUseCase } from './application/use-cases/get-product-price.usecase';
import { PriceListCommandRepository } from './domain/repositories/price-list-command.repository';
import { PriceListQuery } from './application/queries/price-list.query';
import { PriceListPublisherPort } from './application/publishes/publishers/price-list.publisher-port';
import { ProductPriceQueryPort } from './application/outbound-ports/product-price-query.port';
import { SharedOutboxAdapter } from '@platform/platform-common/outbox/adapters/shared-outbox.adapter';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { PrismaPriceListCommandRepository } from './infrastructure/persistence/prisma/prisma-price-list-command.repository';
import { PrismaPriceListQueryRepository } from './infrastructure/persistence/prisma/prisma-price-list-query.repository';
import { CompanyConfigAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { NumberingAdapter } from './infrastructure/adapters/platform/numbering.adapter';

@Module({
  imports: [PlatformModule],
  controllers: [PriceListController],
  providers: [
    CreatePriceListUseCase,
    UpdatePriceListUseCase,
    AddPriceListLineUseCase,
    RemovePriceListLineUseCase,
    ActivatePriceListUseCase,
    DeactivatePriceListUseCase,
    ArchivePriceListUseCase,
    GetProductPriceUseCase,
    { provide: PriceListCommandRepository, useClass: PrismaPriceListCommandRepository },
    { provide: PriceListQuery, useClass: PrismaPriceListQueryRepository },
    {
      provide: PriceListPublisherPort,
      useFactory: (outboxWriter: OutboxWriterPort) =>
        new SharedOutboxAdapter(outboxWriter, 'PriceList'),
      inject: [OutboxWriterPort],
    },
    { provide: ProductPriceQueryPort, useClass: PrismaPriceListQueryRepository },
    CompanyConfigAdapter,
    NumberingAdapter,
  ],
  exports: [ProductPriceQueryPort],
})
export class PricingModule {}
