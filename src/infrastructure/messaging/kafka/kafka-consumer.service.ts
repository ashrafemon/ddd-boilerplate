import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka, KafkaMessage } from 'kafkajs';
import { IntegrationMessage } from '../../../shared-kernel/ports/messaging/integration-message';
import { IntegrationMessageProcessor } from '../../../platform/messaging/integration-message-processor.service';
import {
  ERP_EVENTS_DEAD_LETTER_TOPIC,
  ERP_EVENTS_TOPIC,
} from '../../../platform/messaging/messaging.constants';
import { ConfigurationService } from '../../../config/configuration.service';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';

/**
 * Kafka consumer for integration events. On failure the message is forwarded
 * to the dead-letter topic and the offset is committed, so poison messages
 * never block the pipeline. Retry policy lives on the DLQ topic consumer.
 */
@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnApplicationShutdown {
  private readonly kafka: Kafka;
  private consumer?: Consumer;

  constructor(
    configuration: ConfigurationService,
    private readonly processor: IntegrationMessageProcessor,
    private readonly logger: LoggerPort,
  ) {
    const settings = configuration.getKafka();
    this.groupId = settings.groupId;
    this.kafka = new Kafka({
      clientId: settings.clientId,
      brokers: settings.brokers.split(',').map((broker) => broker.trim()),
    });
  }

  private readonly groupId: string;

  public async onModuleInit(): Promise<void> {
    this.consumer = this.kafka.consumer({ groupId: this.groupId });
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: ERP_EVENTS_TOPIC, fromBeginning: false });
    await this.ensureDeadLetterTopic();

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        await this.handleMessage(message);
      },
    });

    this.logger.info('kafka-consumer-started', { topic: ERP_EVENTS_TOPIC });
  }

  public async onApplicationShutdown(): Promise<void> {
    try {
      await this.consumer?.disconnect();
    } catch (error) {
      this.logger.warn('kafka-consumer-disconnect-failed', { error: errorMessageOf(error) });
    }
  }

  private async handleMessage(message: KafkaMessage): Promise<void> {
    const raw = message.value?.toString();
    if (!raw) return;

    let integration: IntegrationMessage;
    try {
      integration = JSON.parse(raw) as IntegrationMessage;
    } catch (error) {
      this.logger.error('kafka-message-invalid-json', { error: errorMessageOf(error) });
      return;
    }

    try {
      await this.processor.process(integration);
    } catch (error) {
      await this.sendToDeadLetter(integration, error);
    }
  }

  private async sendToDeadLetter(integration: IntegrationMessage, error: unknown): Promise<void> {
    try {
      const producer = this.kafka.producer();
      await producer.connect();
      await producer.send({
        topic: ERP_EVENTS_DEAD_LETTER_TOPIC,
        messages: [
          {
            key: integration.aggregateId,
            value: JSON.stringify({
              ...integration,
              error: errorMessageOf(error),
            }),
          },
        ],
      });
      await producer.disconnect();
      this.logger.error('kafka-message-dead-lettered', {
        eventId: integration.eventId,
        eventType: integration.eventType,
        error: errorMessageOf(error),
      });
    } catch (deadLetterError) {
      this.logger.error('kafka-dead-letter-publish-failed', {
        error: errorMessageOf(deadLetterError),
      });
    }
  }

  private async ensureDeadLetterTopic(): Promise<void> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      await admin.createTopics({
        topics: [{ topic: ERP_EVENTS_DEAD_LETTER_TOPIC, numPartitions: 1, replicationFactor: 1 }],
      });
      await admin.disconnect();
    } catch (error) {
      this.logger.debug('kafka-dlt-topic-may-exist', { error: errorMessageOf(error) });
    }
  }
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
