import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { SqsService } from '@ssut/nestjs-sqs';
import { randomUUID } from 'crypto';
import {
  IntegrationMessage,
  MessagePublisher,
} from '@business/shared-business/ports/message-publisher.port';

/**
 * SQS publisher adapter. Publishes integration messages through the SQS
 * producer registered by the MessagingModule. No-op transport when SQS is not
 * configured (no queue URL) so local development runs without AWS.
 */
@Injectable()
export class SqsPublisherAdapter implements MessagePublisher {
  private readonly queueUrl: string;
  private readonly producerName = 'producer1';

  constructor(
    private readonly sqs: SqsService,
    config: ConfigService,
  ) {
    const sqsConfig = config.get<{ url: string }>('messaging.sqs', { url: '' });
    this.queueUrl = sqsConfig.url;
  }

  get isEnabled(): boolean {
    return Boolean(this.queueUrl);
  }

  public async publish(message: IntegrationMessage): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    const payload: Parameters<SqsService['send']>[1] = {
      id: message.headers?.['event-id'] ?? randomUUID(),
      body: JSON.stringify({
        eventType: message.eventType,
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        payload: message.payload,
        headers: message.headers ?? {},
        occurredAt: message.occurredAt.toISOString(),
      }),
    };

    await this.sqs.send(this.producerName, payload);
  }
}
