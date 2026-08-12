import { Module } from '@nestjs/common';
import { VendorController } from './presentation/http/controllers/vendor.controller';
import { CreateVendorUseCase } from './application/usecase/create-vendor.usecase';
import { UpdateVendorUseCase } from './application/usecase/update-vendor.usecase';
import { VendorStatusUseCase } from './application/usecase/vendor-status.usecase';
import { GetVendorUseCase } from './application/usecase/get-vendor.usecase';
import { ListVendorsUseCase } from './application/usecase/list-vendors.usecase';
import { GetOrderableVendorUseCase } from './application/usecase/get-orderable-vendor.usecase';
import { VendorRabbitMQConsumer } from './application/consumers/vendor.rabbitmq.consumer';
import { VendorKafkaConsumer } from './application/consumers/vendor.kafka.consumer';
import { VendorSqsConsumer } from './application/consumers/vendor.sqs.consumer';
import { VendorEventEmitterConsumer } from './application/consumers/vendor.event-emitter.consumer';
import { VENDOR_COMMAND_REPOSITORY } from './ports/outbound/vendor-command-repository.port';
import { VENDOR_QUERY_REPOSITORY } from './ports/outbound/vendor-query-repository.port';
import { PrismaVendorCommandRepository } from './infrastructure/persistence/prisma-vendor-command.repository';
import { PrismaVendorQueryRepository } from './infrastructure/persistence/prisma-vendor-query.repository';

/**
 * Vendor aggregate module. Controllers call use cases directly — no inbound
 * ports, no facades. Cross-module consumers resolve GetOrderableVendorUseCase
 * through the ModuleRef.
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
    { provide: VENDOR_COMMAND_REPOSITORY, useClass: PrismaVendorCommandRepository },
    { provide: VENDOR_QUERY_REPOSITORY, useClass: PrismaVendorQueryRepository },
  ],
  exports: [GetVendorUseCase, GetOrderableVendorUseCase, ListVendorsUseCase],
})
export class VendorModule {}
