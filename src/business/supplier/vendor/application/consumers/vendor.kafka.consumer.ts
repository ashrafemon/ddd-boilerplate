import { Injectable, Logger } from '@nestjs/common';
import { KafkaEvent } from '@shared-kernel/decorators/kafka-event.decorator';
import { IntegrationMessage } from '@business/shared-business/ports/message-publisher.port';

@Injectable()
export class VendorKafkaConsumer {
  private readonly logger = new Logger(VendorKafkaConsumer.name);

  @KafkaEvent('VendorCreated')
  onVendorCreated(message: IntegrationMessage): void {
    this.logger.log(`[Kafka] VendorCreated received for ${message.aggregateId}`);
  }
}
