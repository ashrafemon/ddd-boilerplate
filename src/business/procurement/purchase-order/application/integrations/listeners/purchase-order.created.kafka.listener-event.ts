import { Injectable, Logger } from '@nestjs/common';
import { KafkaEvent } from '@shared-kernel/decorators/kafka-event.decorator';
import type { OutboxEnvelope } from '@platform/outbox/outbox.types';

@Injectable()
export class PurchaseOrderKafkaListener {
  private readonly logger = new Logger(PurchaseOrderKafkaListener.name);

  @KafkaEvent('PurchaseOrderCreated')
  onPurchaseOrderCreated(message: OutboxEnvelope): void {
    this.logger.log(`[Kafka] PurchaseOrderCreated received for ${message.aggregateId}`);
  }
}
