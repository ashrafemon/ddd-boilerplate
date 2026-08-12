import { Global, Module } from '@nestjs/common';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NOTIFICATION_DISPATCH } from './ports/notification.port';

/**
 * Notification sub-system — dispatches notifications over the infrastructure
 * channels (SES email / SNS push). Global so business modules can inject the
 * NOTIFICATION_DISPATCH port token anywhere.
 */
@Global()
@Module({
  providers: [
    NotificationDispatchService,
    { provide: NOTIFICATION_DISPATCH, useExisting: NotificationDispatchService },
  ],
  exports: [NOTIFICATION_DISPATCH],
})
export class NotificationModule {}
