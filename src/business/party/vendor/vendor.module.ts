import { OrderableVendorPort } from '@business/procurement/purchase-order/application/outbound-ports/vendor-query.port';
import { Module } from '@nestjs/common';
import { VendorForPurchaseFacade } from './application/facades/vendor-for-purchase.facade';
import { OrderableVendorQueryAdapter } from './application/facades/orderable-vendor-query.adapter';
import { VendorEventEmitterListener } from './application/integrations/listeners/vendor.created.event-emitter.listener-event';
import { VendorKafkaListener } from './application/integrations/listeners/vendor.created.kafka.listener-event';
import { VendorRabbitMQListener } from './application/integrations/listeners/vendor.created.rabbitmq.listener-event';
import { VendorSqsListener } from './application/integrations/listeners/vendor.sqs.listener-event';
import { VendorIntegrationPort } from './application/integrations/publishes/vendor.integration-port';
import { CompanyConfigPort } from './application/outbound-ports/company-config.port';
import { CreateVendorUseCase } from './application/usecases/create-vendor.usecase';
import { GetOrderableVendorUseCase } from './application/usecases/get-orderable-vendor.usecase';
import { GetVendorUseCase } from './application/usecases/get-vendor.usecase';
import { ListVendorsUseCase } from './application/usecases/list-vendors.usecase';
import { UpdateVendorUseCase } from './application/usecases/update-vendor.usecase';
import { VendorStatusUseCase } from './application/usecases/vendor-status.usecase';
import { VendorCommandRepository } from './domain/repositories/vendor-command.repository';
import { VendorQuery } from './application/queries/vendor.query';
import { CompanyConfigAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import { PrismaVendorCommandRepository } from './infrastructure/persistence/prisma-vendor-command.repository';
import { PrismaVendorQueryRepository } from './infrastructure/persistence/prisma-vendor-query.repository';
import { VendorController } from './presentation/http/vendor.controller';
import { VendorForPurchasePort } from '@business/party/vendor/public';
import './domain/events/vendor.registry';

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
    VendorForPurchaseFacade,
    OrderableVendorQueryAdapter,
    { provide: VendorForPurchasePort, useExisting: VendorForPurchaseFacade },
    { provide: OrderableVendorPort, useExisting: OrderableVendorQueryAdapter },
    { provide: VendorCommandRepository, useClass: PrismaVendorCommandRepository },
    { provide: VendorQuery, useClass: PrismaVendorQueryRepository },
    { provide: VendorIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigPort, useClass: CompanyConfigAdapter },
  ],
  exports: [
    GetVendorUseCase,
    GetOrderableVendorUseCase,
    ListVendorsUseCase,
    VendorForPurchasePort,
    OrderableVendorPort,
  ],
})
export class VendorModule {}
