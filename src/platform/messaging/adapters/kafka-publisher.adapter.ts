import { Injectable } from '@nestjs/common';
import {
  IntegrationMessage,
  MessagePublisher,
} from '@platform/messaging/ports/message-publisher.port';
import { KafkaService } from '@infrastructure/messaging/kafka/kafka.service';

/**
 * Kafka publisher adapter. Publishes integration messages through the shared
 * Kafka producer using the event type as topic.
 */
@Injectable()
export class KafkaPublisherAdapter implements MessagePublisher {
  constructor(private readonly kafkaService: KafkaService) {}

  public async publish(message: IntegrationMessage): Promise<void> {
    await this.kafkaService.send({
      topic: message.eventType,
      key: message.aggregateId,
      value: JSON.stringify({
        eventType: message.eventType,
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        payload: message.payload,
        headers: message.headers ?? {},
        occurredAt: message.occurredAt.toISOString(),
      }),
    });
  }
}
