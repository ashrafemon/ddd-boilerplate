import { ConfigService } from '@config/config.service';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { buildBullMqOptions } from './bullmq-config.factory';

/**
 * Shared BullMQ connection wiring. Feature modules register their own queues
 * via BullModule.registerQueue and keep domain publishers/workers locally.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildBullMqOptions,
    }),
  ],
  providers: [],
  exports: [BullModule],
})
export class QueueModule {}
