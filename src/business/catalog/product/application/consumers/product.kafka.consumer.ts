import { Injectable, Logger } from '@nestjs/common';
import { KafkaEvent } from '@shared-kernel/decorators/kafka-event.decorator';
import { IntegrationMessage } from '@business/shared-business/ports';

/**
 * Kafka consumer for Product integration events using the custom @KafkaEvent
 * decorator. The infrastructure KafkaConsumerHost wires these handlers to the
 * broker topic.
 */
@Injectable()
export class ProductKafkaConsumer {
  private readonly logger = new Logger(ProductKafkaConsumer.name);

  @KafkaEvent('ProductCreated')
  onProductCreated(message: IntegrationMessage): void {
    this.logger.log(`[Kafka] ProductCreated received for ${message.aggregateId}`);
  }
}
