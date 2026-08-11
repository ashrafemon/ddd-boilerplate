import { Injectable } from '@nestjs/common';
import { IntegrationMessage } from '../../shared-kernel/ports/messaging/integration-message';
import { MessagePublisherPort } from '../../shared-kernel/ports/messaging/message-publisher.port';
import { LoggerPort } from '../../shared-kernel/ports/observability/logger.port';

/**
 * Fans a message out to every registered transport (RabbitMQ / Kafka / SQS).
 * Transports register themselves when they are enabled.
 */
@Injectable()
export class CompositeMessagePublisher implements MessagePublisherPort {
  private readonly transports: MessagePublisherPort[] = [];

  constructor(private readonly logger: LoggerPort) {}

  public register(transport: MessagePublisherPort): void {
    this.transports.push(transport);
  }

  public get transportCount(): number {
    return this.transports.length;
  }

  public async publish(message: IntegrationMessage): Promise<void> {
    if (this.transports.length === 0) {
      this.logger.debug('outbox-message-no-transport', {
        eventId: message.eventId,
        eventType: message.eventType,
      });
      return;
    }
    await Promise.all(this.transports.map((transport) => transport.publish(message)));
  }

  public async publishAll(messages: IntegrationMessage[]): Promise<void> {
    for (const message of messages) {
      await this.publish(message);
    }
  }
}
