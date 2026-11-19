import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { SagaInboxPort } from './ports/saga-inbox.port';
import { SagaInboxAdapter } from './adapters/saga-inbox.adapter';
import { PrismaSagaInboxRepository } from './repositories/prisma-saga-inbox.repository';
import { BufferSagaInboxEventUseCase } from './use-cases/buffer-saga-inbox-event.usecase';
import { IgnoreBufferedSagaEventsUseCase } from './use-cases/ignore-buffered-saga-events.usecase';
import { ListBufferedSagaEventsUseCase } from './use-cases/list-buffered-saga-events.usecase';
import { MarkSagaEventConsumedUseCase } from './use-cases/mark-saga-event-consumed.usecase';
import { PurgeSagaInboxUseCase } from './use-cases/purge-saga-inbox.usecase';
import { SagaInboxRetentionService } from './services/saga-inbox-retention.service';

/**
 * Platform Saga Inbox module — the `saga_inbox` dedupe + buffer ledger.
 *
 * Separate from `SagaModule` on purpose: the ledger is a storage capability with
 * its own retention policy, and the saga runtime consumes it through
 * `SagaInboxPort` only. Nothing here imports the saga engine, so there is no
 * cycle (saga → saga-inbox, never back).
 *
 * NOT global. `SagaModule` imports it; nobody else should.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    // Outbound adapter → outbound port
    PrismaSagaInboxRepository,

    // Use cases
    BufferSagaInboxEventUseCase,
    ListBufferedSagaEventsUseCase,
    MarkSagaEventConsumedUseCase,
    IgnoreBufferedSagaEventsUseCase,
    PurgeSagaInboxUseCase,

    // Scheduled retention
    SagaInboxRetentionService,

    // Inbound port implementation
    SagaInboxAdapter,
    { provide: SagaInboxPort, useExisting: SagaInboxAdapter },
  ],
  exports: [SagaInboxPort],
})
export class SagaInboxModule {}
