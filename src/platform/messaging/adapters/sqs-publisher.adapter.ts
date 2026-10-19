import { ConfigService } from '@config/config.service';
import { Injectable } from '@nestjs/common';
import { SqsService } from '@ssut/nestjs-sqs';
import { OutboxEnvelope } from '@platform/outbox/outbox.types';
import { BrokerPublisher } from '../message-publisher.tokens';

/**
 * SQS publisher adapter. Sends the canonical envelope to the configured queue.
 * Disabled without SQS_URL — an unconfigured target throws so the outbox
 * retries rather than silently dropping the message.
 */
@Injectable()
export class SqsPublisherAdapter implements BrokerPublisher {
  private readonly queueUrl: string;
  private readonly producerName = 'producer1';

  constructor(
    private readonly sqs: SqsService,
    config: ConfigService,
  ) {
    this.queueUrl = config.getSqs().url;
  }

  get isEnabled(): boolean {
    return Boolean(this.queueUrl);
  }

  public async publish(envelope: OutboxEnvelope): Promise<void> {
    if (!this.isEnabled) {
      throw new Error('SQS broker target requested but SQS_URL is not configured');
    }

    const payload: Parameters<SqsService['send']>[1] = {
      id: envelope.eventId,
      body: JSON.stringify({
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
        payload: envelope.payload,
        headers: envelope.headers ?? {},
        occurredAt: envelope.occurredAt.toISOString(),
      }),
    };

    await this.sqs.send(this.producerName, payload);
  }
}
