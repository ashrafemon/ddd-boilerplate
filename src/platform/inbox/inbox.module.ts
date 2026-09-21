import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { ContextModule } from '@platform/context/context.module';
import { InboxPort } from './ports/inbox.port';
import { InboxRepositoryPort } from './ports/inbox-repository.port';
import { PrismaInboxRepository } from './repositories/prisma-inbox.repository';
import { ReceiveInboxMessageUseCase } from './usecases/receive-inbox-message.usecase';
import { CompleteInboxMessageUseCase } from './usecases/complete-inbox-message.usecase';
import { FailInboxMessageUseCase } from './usecases/fail-inbox-message.usecase';
import { ClaimInboxRetryUseCase } from './usecases/claim-inbox-retry.usecase';
import { InboxService } from './inbox.service';
import { InboxReconciler } from './inbox-reconciliation';

/**
 * Platform Inbox module — durable inbound message claim and deduplication boundary.
 *
 * The Inbox is the consumer-side counterpart of Outbox.
 * Outbox protects reliable publication; Inbox protects reliable consumption.
 *
 * This module is NOT global. Business modules must import PlatformModule.
 */
@Module({
  imports: [ContextModule, PrismaModule],
  providers: [
    // Repository — PostgreSQL inbox metadata
    PrismaInboxRepository,
    { provide: InboxRepositoryPort, useExisting: PrismaInboxRepository },

    // Use cases — one per file
    ReceiveInboxMessageUseCase,
    CompleteInboxMessageUseCase,
    FailInboxMessageUseCase,
    ClaimInboxRetryUseCase,

    // Facade → public port
    InboxService,
    { provide: InboxPort, useExisting: InboxService },

    // Reconciliation
    InboxReconciler,
  ],
  exports: [InboxPort],
})
export class InboxModule {}
