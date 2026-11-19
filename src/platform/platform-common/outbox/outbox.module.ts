import { Module } from '@nestjs/common';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { EventsModule } from '@platform/platform-common/events/events.module';
import { MessagingModule } from '@platform/platform-common/messaging/messaging.module';
import { PrismaOutboxRepository } from './repositories/prisma-outbox.repository';
import { AppendOutboxEventUseCase } from './use-cases/append-outbox-event.usecase';
import { PublishPendingBatchUseCase } from './use-cases/publish-pending-batch.usecase';
import { PurgePublishedOutboxUseCase } from './use-cases/purge-published-outbox.usecase';
import { OutboxWriterAdapter } from './adapters/outbox-writer.adapter';
import { OutboxWriterPort } from './ports/outbox-writer.port';
import { OutboxDispatcherService } from './services/outbox-dispatcher.service';
import { PublishPendingBatchService } from './services/publish-pending-batch.service';

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
    // Outbound adapter (concrete class, no port token)
    PrismaOutboxRepository,

    // Use cases
    AppendOutboxEventUseCase,
    PublishPendingBatchUseCase,
    PurgePublishedOutboxUseCase,

    // Orchestration services (per-row dispatch + scheduled tick)
    PublishPendingBatchService,
    OutboxDispatcherService,

    // Inbound port implementation
    OutboxWriterAdapter,
    { provide: OutboxWriterPort, useExisting: OutboxWriterAdapter },
  ],
  exports: [OutboxWriterPort, PublishPendingBatchService],
})
export class OutboxModule {}
