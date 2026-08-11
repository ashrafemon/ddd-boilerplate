import { Global, Module } from '@nestjs/common';
import { EmailPort } from '@shared-kernel/ports/notification/email.port';
import { NotificationPort } from '@shared-kernel/ports/notification/notification.port';
import { SesEmailAdapter } from './ses/ses-email.adapter';
import { SesService } from './ses/ses.service';
import { SnsNotificationAdapter } from './sns/sns-notification.adapter';
import { SnsService } from './sns/sns.service';

/**
 * Notification infrastructure (SNS/SES). Each AWS service is wrapped in a
 * client service that self-disables when not configured; the port adapters
 * expose them to the platform/business layers.
 */
@Global()
@Module({
  providers: [
    SnsService,
    SesService,
    { provide: EmailPort, useClass: SesEmailAdapter },
    { provide: NotificationPort, useClass: SnsNotificationAdapter },
  ],
  exports: [EmailPort, NotificationPort],
})
export class NotificationModule {}
