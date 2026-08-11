import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { OutboxPort } from '../../shared-kernel/ports/outbox/outbox.port';
import { OutboxReadStorePort } from '../../shared-kernel/ports/outbox/outbox-read-store.port';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { PrismaOutboxRepository } from './prisma-outbox.repository';
import { PrismaOutboxReadStore } from './prisma-outbox-read-store';

/**
 * Platform outbox module. Owns the transactional outbox end to end: the port
 * contracts, the Prisma-backed implementation and the dispatcher that
 * publishes committed domain events to the message transports.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    { provide: OutboxPort, useClass: PrismaOutboxRepository },
    { provide: OutboxReadStorePort, useClass: PrismaOutboxReadStore },
    OutboxDispatcherService,
  ],
  exports: [OutboxPort, OutboxReadStorePort, OutboxDispatcherService],
})
export class OutboxModule {}
