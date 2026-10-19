import { Injectable, Logger } from '@nestjs/common';
import { KafkaEvent } from '@shared-kernel/decorators/kafka-event.decorator';
import type { OutboxEnvelope } from '@platform/outbox/outbox.types';

@Injectable()
export class GrnKafkaListener {
  private readonly logger = new Logger(GrnKafkaListener.name);

  @KafkaEvent('GrnCreated')
  onGrnCreated(message: OutboxEnvelope): void {
    this.logger.log(`[Kafka] GrnCreated received for ${message.aggregateId}`);
  }
}
