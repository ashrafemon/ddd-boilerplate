import { Injectable, Logger } from '@nestjs/common';
import { KafkaEvent } from '@shared-kernel/decorators/kafka-event.decorator';
import { IntegrationMessage } from '@business/shared-business/ports';

@Injectable()
export class PurchaseOrderKafkaConsumer {
  private readonly logger = new Logger(PurchaseOrderKafkaConsumer.name);

  @KafkaEvent('PurchaseOrderCreated')
  onPurchaseOrderCreated(message: IntegrationMessage): void {
    this.logger.log(`[Kafka] PurchaseOrderCreated received for ${message.aggregateId}`);
  }
}
