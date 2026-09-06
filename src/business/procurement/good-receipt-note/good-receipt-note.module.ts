import { Module } from '@nestjs/common';
import { GrnQueryFacade } from './application/facades/grn-query.facade';
import { GrnEventEmitterListener } from './application/integrations/listeners/grn.event-emitter.listener';
import { GrnKafkaListener } from './application/integrations/listeners/grn.kafka.listener';
import { GrnRabbitMQListener } from './application/integrations/listeners/grn.rabbitmq.listener';
import { GrnSqsListener } from './application/integrations/listeners/grn.sqs.listener';
import { GrnIntegrationPort } from './application/integrations/publishers/grn.integration-port';
import { CompanyConfigOutboundPort } from './application/outbound-ports/company-config.port';
import { CreateGrnUseCase } from './application/usecase/create-grn.usecase';
import { AddGrnLineUseCase } from './application/usecase/add-grn-line.usecase';
import { ReceiveGrnUseCase } from './application/usecase/receive-grn.usecase';
import { CompleteGrnUseCase } from './application/usecase/complete-grn.usecase';
import { GetGrnUseCase } from './application/usecase/get-grn.usecase';
import { ListGrnsUseCase } from './application/usecase/list-grns.usecase';
import { GrnCommandRepositoryPort } from './domain/domain-ports/grn-command-repository.port';
import { GrnQueryRepositoryPort } from './domain/domain-ports/grn-query-repository.port';
import { CompanyConfigOutboundAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import { PrismaGrnCommandRepository } from './infrastructure/persistence/prisma-grn-command.repository';
import { PrismaGrnQueryRepository } from './infrastructure/persistence/prisma-grn-query.repository';
import { GrnController } from './presentation/http/grn.controller';
import { GrnQueryPort } from './public/ports/grn.port';
import './domain/domain-events/grn.registry';

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
