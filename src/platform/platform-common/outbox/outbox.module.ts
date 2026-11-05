import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module';
import { EventsModule } from '../events/events.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaOutboxRepository } from './repositories/prisma-outbox.repository';
import { AppendOutboxEventUseCase } from './usecases/append-outbox-event.usecase';
import { PublishPendingBatchUseCase } from './usecases/publish-pending-batch.usecase';
import { OutboxService } from './services/outbox.service';
import { OutboxWriterPort } from './ports/outbox-writer.port';
import { OutboxScheduler } from './outbox.scheduler';

/**
 * Platform Outbox module — transactional event publication boundary.
 *
 * Business modules consume only `OutboxWriterPort`. The scheduler publishes
 * later to `MessageQueuePort` (broker by envelope param) and `InProcessEventBus`
 * (local @OnEvent listeners).
 *
 * This module is NOT global. Business modules must import PlatformModule.
 */
@Module({
  imports: [MessagingModule, EventsModule, ContextModule],
  providers: [
    PrismaOutboxRepository,
    AppendOutboxEventUseCase,
    PublishPendingBatchUseCase,
    OutboxService,
    { provide: OutboxWriterPort, useExisting: OutboxService },
    OutboxScheduler,
  ],
  exports: [OutboxWriterPort],
})
export class OutboxModule {}
