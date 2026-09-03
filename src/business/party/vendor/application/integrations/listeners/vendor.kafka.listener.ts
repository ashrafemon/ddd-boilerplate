import { Injectable, Logger } from '@nestjs/common';
import { KafkaEvent } from '@shared-kernel/decorators/kafka-event.decorator';
import { IntegrationMessage } from '@shared-kernel/ports';

@Injectable()
export class VendorKafkaListener {
  private readonly logger = new Logger(VendorKafkaListener.name);

  @KafkaEvent('VendorCreated')
  onVendorCreated(message: IntegrationMessage): void {
    this.logger.log(`[Kafka] VendorCreated received for ${message.aggregateId}`);
  }
}