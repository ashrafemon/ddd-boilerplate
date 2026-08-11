import { PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';
import { Injectable } from '@nestjs/common';
import {
  NotificationMessage,
  NotificationPort,
} from '@shared-kernel/ports/notification/notification.port';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';
import { SnsService } from './sns.service';

/**
 * AWS SNS notification adapter. Self-disables when SNS is not configured so
 * local development runs without AWS.
 */
@Injectable()
export class SnsNotificationAdapter implements NotificationPort {
  constructor(
    private readonly snsService: SnsService,
    private readonly logger: LoggerPort,
  ) {}

  public async send(message: NotificationMessage): Promise<void> {
    const client = this.snsService.client;
    const topicArn = this.snsService.topic;
    if (!client || !topicArn) {
      this.logger.debug('sns-notification-skipped-disabled', { subject: message.subject });
      return;
    }

    const input: PublishCommandInput = {
      TopicArn: topicArn,
      Subject: message.subject.slice(0, 100),
      Message: JSON.stringify({
        body: message.body,
        channels: message.channels,
        metadata: message.metadata ?? {},
      }),
      MessageAttributes: {
        correlationId: { DataType: 'String', StringValue: message.correlationId ?? '' },
        tenantId: { DataType: 'String', StringValue: message.tenantId ?? '' },
        organizationId: { DataType: 'String', StringValue: message.organizationId ?? '' },
      },
    };

    await client.send(new PublishCommand(input));
    this.logger.info('sns-notification-published', {
      subject: message.subject,
      correlationId: message.correlationId,
    });
  }
}
