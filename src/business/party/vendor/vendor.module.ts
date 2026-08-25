import { OrderableVendorQueryPort } from '@business/procurement/purchase';
import { Module } from '@nestjs/common';
import { VendorQueryAdapter } from './application/inbound-adapters';
import {
  VendorEventEmitterConsumer,
  VendorKafkaConsumer,
  VendorRabbitMQConsumer,
  VendorSqsConsumer,
} from './application/integrations';
import {
  CreateVendorUseCase,
  GetOrderableVendorUseCase,
  GetVendorUseCase,
  ListVendorsUseCase,
  UpdateVendorUseCase,
  VendorStatusUseCase,
} from './application/usecase';
import { VendorCommandRepositoryPort, VendorQueryRepositoryPort } from './domain/domain-ports';
import {
  PrismaVendorCommandRepository,
  PrismaVendorQueryRepository,
} from './infrastructure/persistence';
import { VendorController } from './presentation/http/vendor.controller';

/**
 * Vendor aggregate module. Controllers call use cases directly — no inbound
 * ports, no facades. VendorQueryAdapter implements PurchaseOrder's outbound
 * port contract in this module; the binding is exported so PurchaseOrder can
 * resolve it through the ModuleRef without importing this module.
 */
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
    VendorQueryAdapter,
    { provide: OrderableVendorQueryPort, useExisting: VendorQueryAdapter },
    { provide: VendorCommandRepositoryPort, useClass: PrismaVendorCommandRepository },
    { provide: VendorQueryRepositoryPort, useClass: PrismaVendorQueryRepository },
  ],
  exports: [
    GetVendorUseCase,
    GetOrderableVendorUseCase,
    ListVendorsUseCase,
    OrderableVendorQueryPort,
  ],
})
export class VendorModule {}
