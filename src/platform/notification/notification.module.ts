import { Global, Module } from '@nestjs/common';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationDispatchPort } from './ports/notification.port';

/**
 * Notification sub-system — dispatches notifications over the infrastructure
 * channels (SES email / SNS push). Global so business modules can inject the
 * NotificationDispatchPort port anywhere.
 */
@Global()
@Module({
  providers: [
    NotificationDispatchService,
    { provide: NotificationDispatchPort, useExisting: NotificationDispatchService },
  ],
  exports: [NotificationDispatchPort],
})
export class NotificationModule {}
