import { Module } from '@nestjs/common';
import { VendorController } from './presentation/http/controllers';
import { CreateVendorUseCase } from './application/usecase';
import { UpdateVendorUseCase } from './application/usecase';
import { VendorStatusUseCase } from './application/usecase';
import { GetVendorUseCase } from './application/usecase';
import { ListVendorsUseCase } from './application/usecase';
import { GetOrderableVendorUseCase } from './application/usecase';
import { VendorRabbitMQConsumer } from './application/consumers';
import { VendorKafkaConsumer } from './application/consumers';
import { VendorSqsConsumer } from './application/consumers';
import { VendorEventEmitterConsumer } from './application/consumers';
import { VendorQueryAdapter } from './application/adapters';
import { VENDOR_COMMAND_REPOSITORY } from './domain/ports';
import { VENDOR_QUERY_REPOSITORY } from './domain/ports';
import { PURCHASE_ORDER_VENDOR_PORT } from '@business/procurement/purchase/application/ports/outbound/vendor-query.port';
import { PrismaVendorCommandRepository } from './infrastructure/persistence';
import { PrismaVendorQueryRepository } from './infrastructure/persistence';

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
    { provide: PURCHASE_ORDER_VENDOR_PORT, useExisting: VendorQueryAdapter },
    { provide: VENDOR_COMMAND_REPOSITORY, useClass: PrismaVendorCommandRepository },
    { provide: VENDOR_QUERY_REPOSITORY, useClass: PrismaVendorQueryRepository },
  ],
  exports: [
    GetVendorUseCase,
    GetOrderableVendorUseCase,
    ListVendorsUseCase,
    PURCHASE_ORDER_VENDOR_PORT,
  ],
})
export class VendorModule {}
