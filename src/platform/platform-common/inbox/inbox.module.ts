import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { ContextModule } from '@platform/context/context.module';
import { InboxPort } from './ports/inbox.port';
import { PrismaInboxRepository } from './repositories/prisma-inbox.repository';
import { ReceiveInboxMessageUseCase } from './usecases/receive-inbox-message.usecase';
import { CompleteInboxMessageUseCase } from './usecases/complete-inbox-message.usecase';
import { FailInboxMessageUseCase } from './usecases/fail-inbox-message.usecase';
import { InboxService } from './inbox.service';
import { InboxReconciler } from './inbox-reconciliation';

/**
 * Platform Inbox module — consumer-side deduplication (design 07).
 *
 * NOT global. Business consumers inject `InboxPort` only; the concrete
 * `PrismaInboxRepository` is injected directly into the use cases (no internal
 * repository port).
 */
@Module({
  imports: [ContextModule, PrismaModule],
  providers: [
    PrismaInboxRepository,
    ReceiveInboxMessageUseCase,
    CompleteInboxMessageUseCase,
    FailInboxMessageUseCase,
    InboxService,
    { provide: InboxPort, useExisting: InboxService },
    InboxReconciler,
  ],
  exports: [InboxPort],
})
export class InboxModule {}
