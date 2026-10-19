import { Injectable, Logger } from '@nestjs/common';
import { KafkaEvent } from '@shared-kernel/decorators/kafka-event.decorator';
import type { OutboxEnvelope } from '@platform/outbox/outbox.types';

@Injectable()
export class VendorKafkaListener {
  private readonly logger = new Logger(VendorKafkaListener.name);

  @KafkaEvent('VendorCreated')
  onVendorCreated(message: OutboxEnvelope): void {
    this.logger.log(`[Kafka] VendorCreated received for ${message.aggregateId}`);
  }
}
