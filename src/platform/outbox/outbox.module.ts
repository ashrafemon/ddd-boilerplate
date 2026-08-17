import { Global, Module } from '@nestjs/common';
import { PrismaOutboxRepository } from './prisma-outbox-repository';
import { OutboxWriter } from './outbox-writer';
import { OutboxPublisher } from './outbox-publisher';
import { OutboxScheduler } from './outbox-scheduler';
import { OutboxRepositoryPort } from './ports/outbox-repository.port';
import { OutboxWriterPort } from './ports/outbox-writer.port';

/**
 * Outbox sub-system — transactional outbox persistence, writing, publishing
 * and the scheduling jobs that drive it. Global so business use cases can
 * inject the OutboxWriterPort / OutboxRepositoryPort port tokens anywhere.
 */
@Global()
@Module({
  providers: [
    PrismaOutboxRepository,
    OutboxWriter,
    OutboxPublisher,
    OutboxScheduler,
    { provide: OutboxWriterPort, useExisting: OutboxWriter },
    { provide: OutboxRepositoryPort, useExisting: PrismaOutboxRepository },
  ],
  exports: [OutboxWriterPort, OutboxRepositoryPort],
})
export class OutboxModule {}
