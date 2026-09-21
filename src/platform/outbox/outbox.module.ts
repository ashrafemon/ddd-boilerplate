import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module';
import { EventsModule } from '../events/events.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaOutboxRepository } from './repositories/outbox.repository';
import { OutboxRepositoryPort } from './ports/outbox-repository.port';
import { AppendOutboxEventUseCase } from './usecases/append-outbox-event.usecase';
import { AppendOutboxEventsBatchUseCase } from './usecases/append-outbox-events-batch.usecase';
import { ClaimOutboxMessagesUseCase } from './usecases/claim-outbox-messages.usecase';
import { MarkOutboxPublishedUseCase } from './usecases/mark-outbox-published.usecase';
import { MarkOutboxFailedUseCase } from './usecases/mark-outbox-failed.usecase';
import { ReleaseOutboxClaimUseCase } from './usecases/release-outbox-claim.usecase';
import { OutboxService } from './outbox.service';
import { OutboxPort } from './ports/outbox.port';
import { OutboxWriterPort } from './ports/outbox-writer.port';
import { OutboxWriter } from './outbox-writer';
import { OutboxDispatcherAdapter } from './adapters/outbox-dispatcher.adapter';
import { OutboxScheduler } from './outbox-scheduler';
import { OutboxReconciler } from './outbox-reconciliation';

/**
 * Platform Outbox module — transactional event publication boundary.
 *
 * Business modules consume only `OutboxPort`. The dispatcher is wired
 * internally and publishes asynchronously to EventBusPort and MessageQueuePort.
 *
 * This module is NOT global. Business modules must import PlatformModule.
 */
@Module({
  imports: [MessagingModule, EventsModule, ContextModule],
  providers: [
    // Repository — PostgreSQL outbox persistence
    PrismaOutboxRepository,
    { provide: OutboxRepositoryPort, useExisting: PrismaOutboxRepository },

    // Use cases — one per file
    AppendOutboxEventUseCase,
    AppendOutboxEventsBatchUseCase,
    ClaimOutboxMessagesUseCase,
    MarkOutboxPublishedUseCase,
    MarkOutboxFailedUseCase,
    ReleaseOutboxClaimUseCase,

    // Facade → public port
    OutboxService,
    { provide: OutboxPort, useExisting: OutboxService },

    // Deprecated adapter for backward-compat `OutboxWriterPort` callers
    OutboxWriter,
    { provide: OutboxWriterPort, useExisting: OutboxWriter },

    // Dispatcher — background event/message delivery
    OutboxDispatcherAdapter,

    // Reconciliation — expired claim recovery
    OutboxReconciler,

    // Scheduler — cron jobs for dispatch and reconciliation
    OutboxScheduler,
  ],
  exports: [OutboxPort, OutboxWriterPort],
})
export class OutboxModule {}
