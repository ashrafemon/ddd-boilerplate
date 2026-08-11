import { Global, Module } from '@nestjs/common';
import { SesService } from './ses/ses.service';
import { SnsService } from './sns/sns.service';

/**
 * Notification infrastructure (SNS/SES). Adapters self-disable when the
 * corresponding AWS service is not configured.
 */
@Global()
@Module({
  providers: [SnsService, SesService],
  exports: [],
})
export class NotificationModule {}
