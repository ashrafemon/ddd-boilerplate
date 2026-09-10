import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { EmailPort } from './ports/email.port';
import { NotificationPort } from './ports/notification.port';
import { NotificationModule as InfraNotificationModule } from '@infrastructure/notification/notification.module';
import { SesEmailAdapter } from './adapters/ses-email.adapter';
import { SnsNotificationAdapter } from './adapters/sns-notification.adapter';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationDispatchPort } from './ports/notification.port';

/**
 * Platform notification module — binds the Email/Notification ports to the raw
 * SES and SNS clients owned by the infrastructure layer.
 */
@Module({
  imports: [InfraNotificationModule, ObservabilityModule],
  providers: [
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
