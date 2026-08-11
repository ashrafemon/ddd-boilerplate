import { Global, Module } from '@nestjs/common';
import { EmailPort } from '../../shared-kernel/ports/notification/email.port';
import { NotificationPort } from '../../shared-kernel/ports/notification/notification.port';
import { SesEmailAdapter } from './ses/ses-email.adapter';
import { SnsNotificationAdapter } from './sns/sns-notification.adapter';

/**
 * Notification infrastructure (SNS/SES). Adapters self-disable when the
 * corresponding AWS service is not configured.
 */
@Global()
@Module({
  providers: [
    { provide: NotificationPort, useClass: SnsNotificationAdapter },
    { provide: EmailPort, useClass: SesEmailAdapter },
  ],
  exports: [NotificationPort, EmailPort],
})
export class NotificationModule {}
