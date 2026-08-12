import { Global, Module } from '@nestjs/common';
import { PrismaOutboxRepository } from './prisma-outbox-repository';
import { OutboxWriter } from './outbox-writer';
import { OutboxPublisher } from './outbox-publisher';
import { OutboxScheduler } from './outbox-scheduler';
import { OUTBOX_REPOSITORY } from './ports/outbox-repository.port';
import { OUTBOX_WRITER } from './ports/outbox-writer.port';

/**
 * Outbox sub-system — transactional outbox persistence, writing, publishing
 * and the scheduling jobs that drive it. Global so business use cases can
 * inject the OUTBOX_WRITER / OUTBOX_REPOSITORY port tokens anywhere.
 */
@Global()
@Module({
  providers: [
    PrismaOutboxRepository,
    OutboxWriter,
    OutboxPublisher,
    OutboxScheduler,
    { provide: OUTBOX_WRITER, useExisting: OutboxWriter },
    { provide: OUTBOX_REPOSITORY, useExisting: PrismaOutboxRepository },
  ],
  exports: [OUTBOX_WRITER, OUTBOX_REPOSITORY],
})
export class OutboxModule {}
