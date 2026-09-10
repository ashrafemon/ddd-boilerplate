import { Injectable, Logger } from '@nestjs/common';
import { KafkaEvent } from '@shared-kernel/decorators/kafka-event.decorator';
import { IntegrationMessage } from '@platform/messaging/ports/message-publisher.port';

/**
 * Kafka listener for Invoice integration events using the custom @KafkaEvent
 * decorator. The infrastructure KafkaConsumerHost wires these handlers to the
 * broker topic.
 */
@Injectable()
export class InvoiceKafkaListener {
  private readonly logger = new Logger(InvoiceKafkaListener.name);

  @KafkaEvent('InvoiceCreated')
  onInvoiceCreated(message: IntegrationMessage): void {
    this.logger.log(`[Kafka] InvoiceCreated received for ${message.aggregateId}`);
  }
}
