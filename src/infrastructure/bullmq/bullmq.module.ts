import { ConfigService } from '@config/config.service';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

/**
 * BullMQ client module — shared connection wiring, initialized inline (the
 * options are too small to warrant a separate factory). Feature modules
 * register their own queues via BullModule.registerQueue and keep domain
 * publishers/workers locally.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getRedis().url || undefined,
          maxRetriesPerRequest: null,
        },
      }),
    }),
  ],
  providers: [],
  exports: [BullModule],
})
export class BullMqModule {}
