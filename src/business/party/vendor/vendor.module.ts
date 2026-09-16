import { Module } from '@nestjs/common';
import { VendorImportHandler } from './infrastructure/adapters/platform/vendor-import.adapter';
import { PlatformModule } from '@platform/platform.module';
import { VendorForPurchaseFacade } from './application/facades/vendor-for-purchase.facade';
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

/**
 * Vendor aggregate module. The import opt-in handler is registered by the
 * composition-root bridge (`src/bootstrap/configure-imports.ts`) — this
 * module carries no lifecycle.
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
    VendorEventEmitterListener,
    VendorRabbitMQListener,
    VendorKafkaListener,
    VendorSqsListener,
    VendorForPurchaseFacade,
    { provide: VendorForPurchasePort, useExisting: VendorForPurchaseFacade },
    { provide: VendorCommandRepository, useClass: PrismaVendorCommandRepository },
    { provide: VendorQuery, useClass: PrismaVendorQueryRepository },
    { provide: VendorIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigPort, useClass: CompanyConfigAdapter },
  ],
  exports: [VendorForPurchasePort],
})
export class VendorModule {}
