import { Injectable, OnModuleInit } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { IntegrationMessage } from '../../../shared-kernel/ports/messaging/integration-message';
import { MessagePublisherPort } from '../../../shared-kernel/ports/messaging/message-publisher.port';
import {
  ERP_EVENTS_EXCHANGE,
  MESSAGE_HEADER_CORRELATION_ID,
  MESSAGE_HEADER_EVENT_ID,
  MESSAGE_HEADER_EVENT_TYPE,
  MESSAGE_HEADER_ORGANIZATION_ID,
  MESSAGE_HEADER_TENANT_ID,
} from '../../../platform/messaging/messaging.constants';
import { ConfigurationService } from '../../../config/configuration.service';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';
import { CompositeMessagePublisher } from '../../../platform/messaging/composite-message-publisher';

/**
 * RabbitMQ publisher transport for integration messages using
 * @golevelup/nestjs-rabbitmq's AmqpConnection.
 */
@Injectable()
export class RabbitMqPublisherAdapter implements MessagePublisherPort, OnModuleInit {
  constructor(
    private readonly amqp: AmqpConnection,
    private readonly configuration: ConfigurationService,
    private readonly logger: LoggerPort,
    private readonly compositePublisher: CompositeMessagePublisher,
  ) {}

  public onModuleInit(): void {
    this.compositePublisher.register(this);
    this.logger.info('rabbitmq-publisher-registered', {
      exchange: this.configuration.getRabbitMq().exchange,
    });
  }

  public async publish(message: IntegrationMessage): Promise<void> {
    await this.amqp.publish(
      ERP_EVENTS_EXCHANGE,
      message.eventType,
      message,
      {
        persistent: true,
        contentType: 'application/json',
        messageId: message.eventId,
        correlationId: message.correlationId,
        timestamp: Math.floor(Date.now() / 1000),
        headers: {
          [MESSAGE_HEADER_EVENT_ID]: message.eventId,
          [MESSAGE_HEADER_EVENT_TYPE]: message.eventType,
          [MESSAGE_HEADER_CORRELATION_ID]: message.correlationId ?? '',
          [MESSAGE_HEADER_TENANT_ID]: message.tenantId,
          [MESSAGE_HEADER_ORGANIZATION_ID]: message.organizationId ?? '',
        },
      },
    );
  }

  public async publishAll(messages: IntegrationMessage[]): Promise<void> {
    for (const message of messages) {
      await this.publish(message);
    }
  }
}
