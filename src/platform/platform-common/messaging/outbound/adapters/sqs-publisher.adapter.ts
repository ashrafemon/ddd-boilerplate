import { ConfigService } from '@config/config.service';
import { Injectable } from '@nestjs/common';
import { SqsService } from '@ssut/nestjs-sqs';
import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { SqsPublisherPort } from '../ports/broker-publisher.port';
import { toWireEnvelope } from './envelope.serializer';

/**
 * SQS publisher adapter. Sends the canonical envelope to the configured queue.
 * Disabled without SQS_URL — an unconfigured target throws so the outbox
 * retries rather than silently dropping the message.
 */
@Injectable()
export class SqsPublisherAdapter implements SqsPublisherPort {
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
      body: JSON.stringify(toWireEnvelope(envelope)),
    };

    await this.sqs.send(this.producerName, payload);
  }
}
