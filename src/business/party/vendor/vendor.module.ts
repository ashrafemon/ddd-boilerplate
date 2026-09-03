import { OrderableVendorQueryPort } from '@business/procurement/purchase';
import { Module } from '@nestjs/common';
import { VendorQueryFacade } from './application/facades';
import {
  VendorEventEmitterConsumer,
  VendorKafkaConsumer,
  VendorRabbitMQConsumer,
  VendorSqsConsumer,
} from './application/integrations';
import { VendorIntegrationPort } from './application/integrations/publishers/vendor.integration-port';
import { CompanyConfigOutboundPort } from './application/outbound-ports/company-config.port';
import {
  CreateVendorUseCase,
  GetOrderableVendorUseCase,
  GetVendorUseCase,
  ListVendorsUseCase,
  UpdateVendorUseCase,
  VendorStatusUseCase,
} from './application/usecase';
import { VendorCommandRepositoryPort, VendorQueryRepositoryPort } from './domain/domain-ports';
import { CompanyConfigOutboundAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import {
  PrismaVendorCommandRepository,
  PrismaVendorQueryRepository,
} from './infrastructure/persistence';
import { VendorController } from './presentation/http/vendor.controller';
import { VendorQueryPort } from './public/ports/vendor.port';
import './domain/domain-events/vendor.registry';

@Module({
  controllers: [VendorController],
  providers: [
    CreateVendorUseCase,
    UpdateVendorUseCase,
    VendorStatusUseCase,
    GetVendorUseCase,
    ListVendorsUseCase,
    GetOrderableVendorUseCase,
    VendorEventEmitterConsumer,
    VendorRabbitMQConsumer,
    VendorKafkaConsumer,
    VendorSqsConsumer,
    VendorQueryFacade,
    { provide: VendorQueryPort, useExisting: VendorQueryFacade },
    { provide: OrderableVendorQueryPort, useExisting: VendorQueryFacade },
    { provide: VendorCommandRepositoryPort, useClass: PrismaVendorCommandRepository },
    { provide: VendorQueryRepositoryPort, useClass: PrismaVendorQueryRepository },
    { provide: VendorIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigOutboundPort, useClass: CompanyConfigOutboundAdapter },
  ],
  exports: [
    GetVendorUseCase,
    GetOrderableVendorUseCase,
    ListVendorsUseCase,
    VendorQueryPort,
    OrderableVendorQueryPort,
  ],
})
export class VendorModule {}