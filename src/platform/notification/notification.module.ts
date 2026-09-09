import { Global, Module } from '@nestjs/common';
import { EmailPort } from './ports/email.port';
import { NotificationPort } from './ports/notification.port';
import { SesService } from '@infrastructure/notification/ses/ses.service';
import { SnsService } from '@infrastructure/notification/sns/sns.service';
import { SesEmailAdapter } from './adapters/ses-email.adapter';
import { SnsNotificationAdapter } from './adapters/sns-notification.adapter';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationDispatchPort } from './ports/notification.port';

@Global()
@Module({
  providers: [
    SesService,
    SnsService,
    SesEmailAdapter,
    SnsNotificationAdapter,
    NotificationDispatchService,
    { provide: EmailPort, useClass: SesEmailAdapter },
    { provide: NotificationPort, useClass: SnsNotificationAdapter },
    { provide: NotificationDispatchPort, useExisting: NotificationDispatchService },
  ],
  exports: [EmailPort, NotificationPort, NotificationDispatchPort],
})
export class NotificationModule {}
