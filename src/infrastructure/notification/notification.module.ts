import { Module } from '@nestjs/common';
import { SesService } from './ses/ses.service';
import { SnsService } from './sns/sns.service';

/**
 * Infrastructure notification module — only AWS client wrappers.
 *
 * Provides raw SES and SNS client services. The platform layer
 * provides the EmailPort and NotificationPort adapters.
 */

@Module({
  providers: [SnsService, SesService],
  exports: [SnsService, SesService],
})
export class NotificationModule {}
