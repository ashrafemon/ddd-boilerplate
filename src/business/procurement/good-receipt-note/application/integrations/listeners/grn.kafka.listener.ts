import { Injectable, Logger } from '@nestjs/common';
import { KafkaEvent } from '@shared-kernel/decorators/kafka-event.decorator';
import { IntegrationMessage } from '@shared-kernel/ports';

@Injectable()
export class GrnKafkaListener {
  private readonly logger = new Logger(GrnKafkaListener.name);

  @KafkaEvent('GrnCreated')
  onGrnCreated(message: IntegrationMessage): void {
    this.logger.log(`[Kafka] GrnCreated received for ${message.aggregateId}`);
  }
}