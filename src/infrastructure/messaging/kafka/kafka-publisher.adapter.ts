import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { IntegrationMessage } from '../../../shared-kernel/ports/messaging/integration-message';
import { MessagePublisherPort } from '../../../shared-kernel/ports/messaging/message-publisher.port';
import {
  ERP_EVENTS_TOPIC,
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
 * Kafka producer transport for integration messages.
 */
@Injectable()
export class KafkaPublisherAdapter implements MessagePublisherPort, OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly producer: Producer;

  constructor(
    configuration: ConfigurationService,
    private readonly logger: LoggerPort,
    private readonly compositePublisher: CompositeMessagePublisher,
  ) {
    const settings = configuration.getKafka();
    this.kafka = new Kafka({
      clientId: settings.clientId,
      brokers: settings.brokers.split(',').map((broker) => broker.trim()),
    });
    this.producer = this.kafka.producer();
  }

  public async onModuleInit(): Promise<void> {
    await this.producer.connect();
    this.compositePublisher.register(this);
    this.logger.info('kafka-producer-connected');
  }

  public async publish(message: IntegrationMessage): Promise<void> {
    await this.producer.send({
      topic: ERP_EVENTS_TOPIC,
      messages: [
        {
          key: message.aggregateId,
          value: JSON.stringify(message),
          headers: {
            [MESSAGE_HEADER_EVENT_ID]: message.eventId,
            [MESSAGE_HEADER_EVENT_TYPE]: message.eventType,
            [MESSAGE_HEADER_CORRELATION_ID]: message.correlationId ?? '',
            [MESSAGE_HEADER_TENANT_ID]: message.tenantId,
            [MESSAGE_HEADER_ORGANIZATION_ID]: message.organizationId ?? '',
          },
        },
      ],
    });
  }

  public async publishAll(messages: IntegrationMessage[]): Promise<void> {
    await this.producer.send({
      topic: ERP_EVENTS_TOPIC,
      messages: messages.map((message) => ({
        key: message.aggregateId,
        value: JSON.stringify(message),
        headers: {
          [MESSAGE_HEADER_EVENT_ID]: message.eventId,
          [MESSAGE_HEADER_EVENT_TYPE]: message.eventType,
          [MESSAGE_HEADER_CORRELATION_ID]: message.correlationId ?? '',
          [MESSAGE_HEADER_TENANT_ID]: message.tenantId,
          [MESSAGE_HEADER_ORGANIZATION_ID]: message.organizationId ?? '',
        },
      })),
    });
  }

  public async onModuleDestroy(): Promise<void> {
    try {
      await this.producer.disconnect();
    } catch (error) {
      this.logger.warn('kafka-producer-disconnect-failed', { error: errorMessageOf(error) });
    }
  }
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
