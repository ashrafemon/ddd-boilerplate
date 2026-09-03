import { OrderableVendorQueryPort } from '@business/procurement/purchase/application/ports/outbound/vendor-query.port';
import { Module } from '@nestjs/common';
import { VendorQueryFacade } from './application/facades/vendor-query.facade';
import { VendorEventEmitterListener } from './application/integrations/listeners/vendor.event-emitter.listener';
import { VendorKafkaListener } from './application/integrations/listeners/vendor.kafka.listener';
import { VendorRabbitMQListener } from './application/integrations/listeners/vendor.rabbitmq.listener';
import { VendorSqsListener } from './application/integrations/listeners/vendor.sqs.listener';
import { VendorIntegrationPort } from './application/integrations/publishers/vendor.integration-port';
import { CompanyConfigOutboundPort } from './application/outbound-ports/company-config.port';
import { CreateVendorUseCase } from './application/usecase/create-vendor.usecase';
import { GetOrderableVendorUseCase } from './application/usecase/get-orderable-vendor.usecase';
import { GetVendorUseCase } from './application/usecase/get-vendor.usecase';
import { ListVendorsUseCase } from './application/usecase/list-vendors.usecase';
import { UpdateVendorUseCase } from './application/usecase/update-vendor.usecase';
import { VendorStatusUseCase } from './application/usecase/vendor-status.usecase';
import { VendorCommandRepositoryPort } from './domain/domain-ports/vendor-command-repository.port';
import { VendorQueryRepositoryPort } from './domain/domain-ports/vendor-query-repository.port';
import { CompanyConfigOutboundAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import { PrismaVendorCommandRepository } from './infrastructure/persistence/prisma-vendor-command.repository';
import { PrismaVendorQueryRepository } from './infrastructure/persistence/prisma-vendor-query.repository';
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
    VendorEventEmitterListener,
    VendorRabbitMQListener,
    VendorKafkaListener,
    VendorSqsListener,
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