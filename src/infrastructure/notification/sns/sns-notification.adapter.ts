import { Injectable } from '@nestjs/common';
import { PublishCommand, PublishCommandInput, SNSClient } from '@aws-sdk/client-sns';
import { ConfigurationService } from '../../../config/configuration.service';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';
import { NotificationMessage, NotificationPort } from '../../../shared-kernel/ports/notification/notification.port';

/**
 * AWS SNS notification adapter. Self-disables when SNS is not configured so
 * local development runs without AWS.
 */
@Injectable()
export class SnsNotificationAdapter implements NotificationPort {
  private readonly sns?: SNSClient;
  private readonly topicArn?: string;

  constructor(
    configuration: ConfigurationService,
    private readonly logger: LoggerPort,
  ) {
    const snsSettings = configuration.getSns();
    if (snsSettings.enabled && snsSettings.topicArn) {
      const aws = configuration.getAws();
      this.sns = new SNSClient({
        region: aws.region,
        credentials: aws.accessKeyId
          ? { accessKeyId: aws.accessKeyId, secretAccessKey: aws.secretAccessKey }
          : undefined,
      });
      this.topicArn = snsSettings.topicArn;
    }
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
