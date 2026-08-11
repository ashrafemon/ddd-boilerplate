import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IntegrationMessage,
  MessagePublisher,
} from '@business/shared-business/ports/message-publisher.port';
import { OUTBOX_REPOSITORY, OutboxRepositoryPort } from '../ports/outbox-repository.port';
import { MessageRoutingPolicy, MESSAGE_ROUTING_POLICY } from '../events/message-routing.policy';
import {
  KAFKA_PUBLISHER,
  RABBITMQ_PUBLISHER,
} from 'src/infrastructure/message/message-publisher.tokens';

/**
 * Publishes pending outbox messages to RabbitMQ/Kafka. If publishing fails,
 * the message is marked FAILED and retried by the scheduler with backoff —
 * events are never lost by committing first and publishing later.
 */
@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private readonly configService: ConfigService;

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepository: OutboxRepositoryPort,
    @Inject(MESSAGE_ROUTING_POLICY) private readonly routingPolicy: MessageRoutingPolicy,
    @Inject(RABBITMQ_PUBLISHER) private readonly rabbitmqPublisher: MessagePublisher,
    @Inject(KAFKA_PUBLISHER) private readonly kafkaPublisher: MessagePublisher,
    configService: ConfigService,
  ) {
    this.configService = configService;
  }

  async publishPendingBatch(): Promise<number> {
    const batchSize = this.config.batchSize;
    const messages = await this.outboxRepository.claimBatch(batchSize);

    let published = 0;
    for (const record of messages) {
      try {
        const message: IntegrationMessage = {
          eventType: record.eventType,
          aggregateType: record.aggregateType,
          aggregateId: record.aggregateId,
          payload: record.payload,
          headers: record.headers ?? undefined,
          occurredAt: record.occurredAt,
          correlationId: record.headers?.['correlation-id'],
          causationId: record.headers?.['causation-id'],
        };

        const target = this.routingPolicy.resolve(record.eventType);
        if (target === 'rabbitmq' || target === 'both') {
          await this.rabbitmqPublisher.publish(message);
        }
        if (target === 'kafka' || target === 'both') {
          await this.kafkaPublisher.publish(message);
        }

        await this.outboxRepository.markPublished(record.id);
        published += 1;
      } catch (err) {
        this.logger.error(
          `Failed to publish outbox message ${record.id} (${record.eventType}): ${(err as Error).message}`,
        );
        await this.outboxRepository.markFailed(record.id, (err as Error).message);
      }
    }

    return published;
  }

  async retryFailed(): Promise<number> {
    const retried = await this.outboxRepository.retryFailed(this.config.maxAttempts);
    if (retried > 0) {
      this.logger.log(`Retrying ${retried} failed outbox messages`);
    }
    return retried;
  }

  async cleanup(): Promise<number> {
    const deleted = await this.outboxRepository.deletePublishedOlderThan(
      this.config.cleanupOlderThanHours,
    );
    if (deleted > 0) {
      this.logger.log(`Cleaned up ${deleted} published outbox messages`);
    }
    return deleted;
  }

  private get config() {
    return this.configService.get<{
      batchSize: number;
      maxAttempts: number;
      cleanupOlderThanHours: number;
    }>('outbox', { batchSize: 50, maxAttempts: 10, cleanupOlderThanHours: 24 });
  }
}
