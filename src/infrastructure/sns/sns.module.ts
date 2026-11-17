import { Module } from '@nestjs/common';
import { SnsService } from './sns.service';

/**
 * SNS client module — AWS SNS client wrapper only.
 *
 * The platform layer provides the channel adapters on top of this client.
 */
@Module({
  providers: [SnsService],
  exports: [SnsService],
})
export class SnsModule {}
