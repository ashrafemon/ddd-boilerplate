import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { EventsModule } from '@platform/platform-common/events/events.module';
import { MessagingModule } from '@platform/platform-common/messaging/messaging.module';
import { SagaOutboxWriterPort } from './inbound/ports/saga-outbox-writer.port';
import { SagaOutboxWriterAdapter } from './inbound/adapters/saga-outbox-writer.adapter';
import { SagaOutboxRepositoryPort } from './outbound/ports/saga-outbox.repository.port';
import { PrismaSagaOutboxRepository } from './outbound/adapters/prisma-saga-outbox.repository';
import { AppendSagaOutboxEventUseCase } from './use-cases/append-saga-outbox-event.usecase';
import { PublishSagaOutboxBatchUseCase } from './use-cases/publish-saga-outbox-batch.usecase';
import { PurgePublishedSagaOutboxUseCase } from './use-cases/purge-published-saga-outbox.usecase';
import { SagaOutboxDispatcherService } from './services/saga-outbox-dispatcher.service';

/**
 * Platform Saga Outbox module — the saga's own publication ledger (`saga_outbox`).
 *
 * Separate from `SagaModule` on purpose: append/settle traffic, retry cadence and
 * retention belong to a storage capability, and the saga runtime only needs the
 * `SagaOutboxWriterPort` seam to record lifecycle events inside its own
 * transaction. Nothing here imports the saga engine, so there is no cycle
 * (saga → saga-outbox, never back).
 *
 * It reuses the shared ledger implementation (`OutboxLedgerRepository`) and the
 * shared publisher use case, so the claim/CAS state machine exists exactly once.
 *
 * NOT global. `SagaModule` imports it; nobody else should.
 */
@Module({
  imports: [ContextModule, EventsModule, MessagingModule, PrismaModule],
  providers: [
    // Outbound adapter → outbound port
    PrismaSagaOutboxRepository,
    { provide: SagaOutboxRepositoryPort, useExisting: PrismaSagaOutboxRepository },

    // Use cases
    AppendSagaOutboxEventUseCase,
    PublishSagaOutboxBatchUseCase,
    PurgePublishedSagaOutboxUseCase,

    // Scheduled orchestration (tick + retention)
    SagaOutboxDispatcherService,

    // Inbound port implementation
    SagaOutboxWriterAdapter,
    { provide: SagaOutboxWriterPort, useExisting: SagaOutboxWriterAdapter },
  ],
  exports: [SagaOutboxWriterPort],
})
export class SagaOutboxModule {}
