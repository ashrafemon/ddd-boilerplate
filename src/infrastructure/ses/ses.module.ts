import { Module } from '@nestjs/common';
import { SesService } from './ses.service';

/**
 * SES client module — AWS SES email client wrapper only.
 *
 * The platform layer provides the channel adapters on top of this client.
 */
@Module({
  providers: [SesService],
  exports: [SesService],
})
export class SesModule {}
