import { Injectable, Logger } from '@nestjs/common';
import { KafkaEvent } from '@shared-kernel/decorators/kafka-event.decorator';
import type { OutboxEnvelope } from '@platform/outbox/outbox.types';

/**
 * Kafka listener for Product integration events using the custom @KafkaEvent
 * decorator. The infrastructure KafkaConsumerHost wires these handlers to the
 * broker topic.
 */
@Injectable()
export class ProductKafkaListener {
  private readonly logger = new Logger(ProductKafkaListener.name);

  @KafkaEvent('ProductCreated')
  onProductCreated(message: OutboxEnvelope): void {
    this.logger.log(`[Kafka] ProductCreated received for ${message.aggregateId}`);
  }
}
