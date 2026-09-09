import { Injectable } from '@nestjs/common';
import { EmailPort, EmailMessage } from './ports/email.port';
import { NotificationPort, NotificationChannel } from './ports/notification.port';
import { NotificationDispatchPort, NotificationMessage } from './ports/notification.port';

/**
 * Dispatches notifications through the infrastructure notification adapters
 * (SES email, SNS push). Self-disabling adapters make this a no-op when the
 * channels are not configured, so local development runs without AWS.
 */
@Injectable()
export class NotificationDispatchService implements NotificationDispatchPort {
  constructor(
    private readonly emailPort: EmailPort,
    private readonly notificationPort: NotificationPort,
  ) {}

  public async send(message: NotificationMessage): Promise<void> {
    if (message.channel === 'email' || message.channel === undefined) {
      const email: EmailMessage = {
        to: message.to,
        subject: message.subject,
        text: message.body,
        correlationId: message.correlationId,
        tenantId: message.tenantId,
        organizationId: message.organizationId,
      };
      await this.emailPort.send(email);
    }

    if (message.channel === 'push' || message.channel === 'sms') {
      const channel: NotificationChannel = { channel: message.channel, recipient: message.to };
      await this.notificationPort.send({
        subject: message.subject,
        body: message.body,
        channels: [channel],
        tenantId: message.tenantId,
        organizationId: message.organizationId,
        correlationId: message.correlationId,
      });
    }
  }
}
