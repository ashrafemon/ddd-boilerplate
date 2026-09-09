import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaOutboxRepository } from './prisma-outbox-repository';
import { OutboxWriter } from './outbox-writer';
import { OutboxPublisher } from './outbox-publisher';
import { OutboxScheduler } from './outbox-scheduler';
import { OutboxWriterPort } from './ports/outbox-writer.port';

@Module({
  imports: [MessagingModule],
  providers: [
    PrismaOutboxRepository,
    OutboxWriter,
    OutboxPublisher,
    OutboxScheduler,
    { provide: OutboxWriterPort, useExisting: OutboxWriter },
  ],
  exports: [OutboxWriterPort],
})
export class OutboxModule {}
