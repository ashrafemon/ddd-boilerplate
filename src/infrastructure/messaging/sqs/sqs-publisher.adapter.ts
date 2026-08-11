import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs';
import { IntegrationMessage } from '../../../shared-kernel/ports/messaging/integration-message';
import { MessagePublisherPort } from '../../../shared-kernel/ports/messaging/message-publisher.port';
import {
  MESSAGE_HEADER_CORRELATION_ID,
  MESSAGE_HEADER_EVENT_ID,
  MESSAGE_HEADER_EVENT_TYPE,
  MESSAGE_HEADER_ORGANIZATION_ID,
  MESSAGE_HEADER_TENANT_ID,
} from '../../../platform/messaging/messaging.constants';
import { ConfigurationService } from '../../../config/configuration.service';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';
import { CompositeMessagePublisher } from '../../../platform/messaging/composite-message-publisher';

/**
 * AWS SQS publisher transport for integration messages.
 */
@Injectable()
export class SqsPublisherAdapter implements MessagePublisherPort, OnModuleInit, OnModuleDestroy {
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;

  constructor(
    configuration: ConfigurationService,
    private readonly logger: LoggerPort,
    private readonly compositePublisher: CompositeMessagePublisher,
  ) {
    const aws = configuration.getAws();
    const sqsSettings = configuration.getSqs();
    this.sqs = new SQSClient({
      region: aws.region,
      credentials:
        aws.accessKeyId && aws.secretAccessKey
          ? { accessKeyId: aws.accessKeyId, secretAccessKey: aws.secretAccessKey }
          : undefined,
    });
    this.queueUrl = sqsSettings.queueUrl;
  }

  public onModuleInit(): void {
    this.compositePublisher.register(this);
    this.logger.info('sqs-publisher-registered', { queueUrl: this.queueUrl });
  }

  public async publish(message: IntegrationMessage): Promise<void> {
    const input: SendMessageCommandInput = {
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        [MESSAGE_HEADER_EVENT_ID]: { DataType: 'String', StringValue: message.eventId },
        [MESSAGE_HEADER_EVENT_TYPE]: { DataType: 'String', StringValue: message.eventType },
        [MESSAGE_HEADER_CORRELATION_ID]: {
          DataType: 'String',
          StringValue: message.correlationId ?? '',
        },
        [MESSAGE_HEADER_TENANT_ID]: { DataType: 'String', StringValue: message.tenantId },
        [MESSAGE_HEADER_ORGANIZATION_ID]: {
          DataType: 'String',
          StringValue: message.organizationId ?? '',
        },
      },
    };
    await this.sqs.send(new SendMessageCommand(input));
  }

  public async publishAll(messages: IntegrationMessage[]): Promise<void> {
    for (const message of messages) {
      await this.publish(message);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    this.sqs.destroy();
  }
}
