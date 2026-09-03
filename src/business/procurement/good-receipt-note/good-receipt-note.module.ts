import { Module } from '@nestjs/common';
import { GrnQueryFacade } from './application/facades';
import {
  GrnEventEmitterListener,
  GrnKafkaListener,
  GrnRabbitMQListener,
  GrnSqsListener,
} from './application/integrations/listeners';
import { GrnIntegrationPort } from './application/integrations/publishers/grn.integration-port';
import { CompanyConfigOutboundPort } from './application/outbound-ports/company-config.port';
import {
  CreateGrnUseCase,
  AddGrnLineUseCase,
  ReceiveGrnUseCase,
  CompleteGrnUseCase,
  GetGrnUseCase,
  ListGrnsUseCase,
} from './application/usecase';
import { GrnCommandRepositoryPort, GrnQueryRepositoryPort } from './domain/ports';
import { CompanyConfigOutboundAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import { PrismaGrnCommandRepository, PrismaGrnQueryRepository } from './infrastructure/persistence';
import { GrnController } from './presentation/http/controllers';
import { GrnQueryPort } from './public/ports/grn.port';
import './domain/events/grn.registry';

@Module({
  controllers: [GrnController],
  providers: [
    CreateGrnUseCase,
    AddGrnLineUseCase,
    ReceiveGrnUseCase,
    CompleteGrnUseCase,
    GetGrnUseCase,
    ListGrnsUseCase,
    GrnEventEmitterListener,
    GrnKafkaListener,
    GrnRabbitMQListener,
    GrnSqsListener,
    GrnQueryFacade,
    { provide: GrnQueryPort, useExisting: GrnQueryFacade },
    { provide: GrnCommandRepositoryPort, useClass: PrismaGrnCommandRepository },
    { provide: GrnQueryRepositoryPort, useClass: PrismaGrnQueryRepository },
    { provide: GrnIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigOutboundPort, useClass: CompanyConfigOutboundAdapter },
  ],
  exports: [GrnQueryPort],
})
export class GoodReceiptNoteModule {}