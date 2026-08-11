import { PublishCommand, PublishCommandInput, SNSClient } from '@aws-sdk/client-sns';
import { ISnsConfig } from '@config/notification.config';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationMessage,
  NotificationPort,
} from '../../../shared-kernel/ports/notification/notification.port';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';

/**
 * AWS SNS notification adapter. Self-disables when SNS is not configured so
 * local development runs without AWS.
 */
@Injectable()
export class SnsNotificationAdapter implements NotificationPort {
  private readonly sns?: SNSClient;
  private readonly topicArn?: string;

  constructor(
    config: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    const snsConfig = config.get<ISnsConfig>('notification.sns');
    if (!snsConfig?.accessKey || !snsConfig.secretKey || !snsConfig.topicArn) {
      return;
    }

    this.sns = new SNSClient({
      region: snsConfig.region,
      credentials: { accessKeyId: snsConfig.accessKey, secretAccessKey: snsConfig.secretKey },
    });
    this.topicArn = snsConfig.topicArn;
  }

  public async send(message: NotificationMessage): Promise<void> {
    if (!this.sns || !this.topicArn) {
      this.logger.debug('sns-notification-skipped-disabled', { subject: message.subject });
      return;
    }

    const input: PublishCommandInput = {
      TopicArn: this.topicArn,
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

    await this.sns.send(new PublishCommand(input));
    this.logger.info('sns-notification-published', {
      subject: message.subject,
      correlationId: message.correlationId,
    });
  }
}
