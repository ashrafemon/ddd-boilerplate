import { Injectable } from '@nestjs/common';
import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { KafkaService } from '@infrastructure/kafka/kafka.service';
import { KafkaPublisherPort } from '../ports/broker-publisher.port';
import { toWireEnvelope } from './envelope.serializer';

/**
 * Kafka publisher adapter. Topic = event type; the whole canonical envelope is
 * the value. Disabled without KAFKA_BROKERS (the publish use case throws for an
 * unconfigured target so the outbox retries).
 */
@Injectable()
export class KafkaPublisherAdapter implements KafkaPublisherPort {
  constructor(private readonly kafkaService: KafkaService) {}

  public async publish(envelope: OutboxEnvelope): Promise<void> {
    await this.kafkaService.send({
      topic: envelope.eventType,
      key: envelope.aggregateId,
      value: JSON.stringify(toWireEnvelope(envelope)),
    });
  }
}
