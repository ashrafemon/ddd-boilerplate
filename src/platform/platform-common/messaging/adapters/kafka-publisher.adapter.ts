import { Injectable } from '@nestjs/common';
import { OutboxEnvelope } from '@platform/outbox/outbox.types';
import { KafkaService } from '@infrastructure/messaging/kafka/kafka.service';
import { BrokerPublisher } from '../message-publisher.tokens';

/**
 * Kafka publisher adapter. Topic = event type; the whole canonical envelope is
 * the value. Disabled without KAFKA_BROKERS (the publish use case throws for an
 * unconfigured target so the outbox retries).
 */
@Injectable()
export class KafkaPublisherAdapter implements BrokerPublisher {
  constructor(private readonly kafkaService: KafkaService) {}

  public async publish(envelope: OutboxEnvelope): Promise<void> {
    await this.kafkaService.send({
      topic: envelope.eventType,
      key: envelope.aggregateId,
      value: JSON.stringify({
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
        payload: envelope.payload,
        headers: envelope.headers ?? {},
        occurredAt: envelope.occurredAt.toISOString(),
      }),
    });
  }
}
