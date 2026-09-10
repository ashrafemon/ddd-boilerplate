import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module';
import { EventsModule } from '../events/events.module';
import { MessagingModule } from '../messaging/messaging.module';
import { OutboxRepository, PrismaOutboxRepository } from './prisma-outbox-repository';
import { OutboxWriter } from './outbox-writer';
import { OutboxPublisher } from './outbox-publisher';
import { OutboxScheduler } from './outbox-scheduler';
import { OutboxWriterPort } from './ports/outbox-writer.port';

@Module({
  imports: [MessagingModule, EventsModule, ContextModule],
  providers: [
    PrismaOutboxRepository,
    { provide: OutboxRepository, useExisting: PrismaOutboxRepository },
    OutboxWriter,
    OutboxPublisher,
    OutboxScheduler,
    { provide: OutboxWriterPort, useExisting: OutboxWriter },
  ],
  exports: [OutboxWriterPort],
})
export class OutboxModule {}
