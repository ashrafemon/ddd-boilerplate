import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { InboxPort } from '../../shared-kernel/ports/idempotency/inbox.port';
import { PrismaInboxService } from './prisma-inbox.service';
import { IdempotencyService } from './idempotency.service';

/**
 * Platform idempotency module. Owns consumer-side idempotency end to end: the
 * inbox port, its Prisma-backed implementation and the idempotency service
 * used by the messaging consumers to deduplicate messages (inbox pattern).
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    { provide: InboxPort, useClass: PrismaInboxService },
    IdempotencyService,
  ],
  exports: [InboxPort, IdempotencyService],
})
export class IdempotencyModule {}
