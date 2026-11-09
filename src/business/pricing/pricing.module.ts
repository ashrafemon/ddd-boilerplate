import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { PriceListController } from './presentation/http/price-list.controller';
import { CreatePriceListUseCase } from './application/usecases/create-price-list.usecase';
import { UpdatePriceListUseCase } from './application/usecases/update-price-list.usecase';
import { AddPriceListLineUseCase } from './application/usecases/add-price-list-line.usecase';
import { RemovePriceListLineUseCase } from './application/usecases/remove-price-list-line.usecase';
import { ActivatePriceListUseCase } from './application/usecases/activate-price-list.usecase';
import { DeactivatePriceListUseCase } from './application/usecases/deactivate-price-list.usecase';
import { ArchivePriceListUseCase } from './application/usecases/archive-price-list.usecase';
import { GetProductPriceUseCase } from './application/usecases/get-product-price.usecase';
import { PriceListCommandRepository } from './domain/repositories/price-list-command.repository';
import { PriceListQuery } from './application/queries/price-list.query';
import { PriceListPublisherPort } from './application/integrations/publishers/price-list.publisher-port';
import { ProductPriceQueryPort } from './application/outbound-ports/product-price-query.port';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
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
    { provide: PriceListPublisherPort, useClass: OutboxAdapter },
    { provide: ProductPriceQueryPort, useClass: PrismaPriceListQueryRepository },
    CompanyConfigAdapter,
    NumberingAdapter,
  ],
  exports: [ProductPriceQueryPort],
})
export class PricingModule {}
