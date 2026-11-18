import { Module } from '@nestjs/common';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { EventsModule } from '@platform/platform-common/events/events.module';
import { MessagingModule } from '@platform/platform-common/messaging/messaging.module';
import { PrismaOutboxRepository } from './outbound/adapters/prisma-outbox.repository';
import { OutboxRepositoryPort } from './outbound/ports/outbox.repository.port';
import { AppendOutboxEventUseCase } from './use-cases/append-outbox-event.usecase';
import { PublishPendingBatchUseCase } from './use-cases/publish-pending-batch.usecase';
import { PurgePublishedOutboxUseCase } from './use-cases/purge-published-outbox.usecase';
import { OutboxWriterAdapter } from './inbound/adapters/outbox-writer.adapter';
import { OutboxWriterPort } from './inbound/ports/outbox-writer.port';
import { OutboxDispatcherService } from './services/outbox-dispatcher.service';

/**
 * Platform Outbox module — the transactional event publication boundary.
 *
 * Business modules consume only `OutboxWriterPort`. The dispatcher publishes
 * later to `MessageQueuePort` (broker named by the envelope) and to
 * `InProcessEventBus` (local `@OnEvent` listeners) on one canonical envelope.
 *
 * This module is NOT global. Business modules must import PlatformModule.
 */
@Module({
  imports: [MessagingModule, EventsModule, ContextModule],
  providers: [
    // Outbound adapter → outbound port
    PrismaOutboxRepository,
    { provide: OutboxRepositoryPort, useExisting: PrismaOutboxRepository },

    // Use cases
    AppendOutboxEventUseCase,
    PublishPendingBatchUseCase,
    PurgePublishedOutboxUseCase,

    // Scheduled orchestration (tick + retention)
    OutboxDispatcherService,

    // Inbound port implementation
    OutboxWriterAdapter,
    { provide: OutboxWriterPort, useExisting: OutboxWriterAdapter },
  ],
  exports: [OutboxWriterPort],
})
export class OutboxModule {}
