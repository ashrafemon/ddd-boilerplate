import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { InboxPort } from './inbound/ports/inbox.port';
import { InboxAdapter } from './inbound/adapters/inbox.adapter';
import { InboxRepositoryPort } from './outbound/ports/inbox.repository.port';
import { PrismaInboxRepository } from './outbound/adapters/prisma-inbox.repository';
import { ReceiveInboxMessageUseCase } from './use-cases/receive-inbox-message.usecase';
import { CompleteInboxMessageUseCase } from './use-cases/complete-inbox-message.usecase';
import { FailInboxMessageUseCase } from './use-cases/fail-inbox-message.usecase';
import { InboxReconciliationService } from './services/inbox-reconciliation.service';

/**
 * Platform Inbox module — consumer-side deduplication (design `common/07-inbox`).
 *
 * NOT global. Business consumers inject `InboxPort`, implement nothing, and let
 * the port decide duplicate vs first delivery; the reconciliation sweep parks
 * poison and purges processed rows on a cron.
 */
@Module({
  imports: [ContextModule, PrismaModule],
  providers: [
    // Outbound adapter → outbound port
    PrismaInboxRepository,
    { provide: InboxRepositoryPort, useExisting: PrismaInboxRepository },

    // Use cases
    ReceiveInboxMessageUseCase,
    CompleteInboxMessageUseCase,
    FailInboxMessageUseCase,

    // Scheduled orchestration
    InboxReconciliationService,

    // Inbound port implementation
    InboxAdapter,
    { provide: InboxPort, useExisting: InboxAdapter },
  ],
  exports: [InboxPort],
})
export class InboxModule {}
