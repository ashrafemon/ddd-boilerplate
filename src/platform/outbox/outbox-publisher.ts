import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IntegrationMessage,
  MessagePublisher,
} from '@business/shared-business/ports/message-publisher.port';
import {
  OUTBOX_REPOSITORY,
  OutboxMessageRecord,
  OutboxRepositoryPort,
} from './ports/outbox-repository.port';
import { MessageRoutingPolicy, MESSAGE_ROUTING_POLICY } from '../events/message-routing.policy';
import {
  KAFKA_PUBLISHER,
  RABBITMQ_PUBLISHER,
  SQS_PUBLISHER,
} from '@infrastructure/messaging/message-publisher.tokens';

const PARALLEL_PUBLISH_LIMIT = 10;

/**
 * Publishes pending outbox messages to the configured brokers. If publishing
 * fails, the message is marked FAILED and retried by the scheduler — events
 * are never lost by committing first and publishing later.
 */
@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private readonly configService: ConfigService;
  private publishing = false;

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepository: OutboxRepositoryPort,
    @Inject(MESSAGE_ROUTING_POLICY) private readonly routingPolicy: MessageRoutingPolicy,
    @Inject(RABBITMQ_PUBLISHER) private readonly rabbitmqPublisher: MessagePublisher,
    @Inject(KAFKA_PUBLISHER) private readonly kafkaPublisher: MessagePublisher,
    @Inject(SQS_PUBLISHER) private readonly sqsPublisher: MessagePublisher,
    configService: ConfigService,
  ) {
    this.configService = configService;
  }

  async publishPendingBatch(): Promise<number> {
    if (this.publishing) {
      return 0;
    }
    this.publishing = true;
    try {
      const batchSize = this.config.batchSize;
      const messages = await this.outboxRepository.claimBatch(batchSize);

      for (const chunk of chunkArray(messages, PARALLEL_PUBLISH_LIMIT)) {
        await Promise.all(chunk.map(record => this.publishOne(record)));
      }

      return messages.length;
    } finally {
      this.publishing = false;
    }
  }

  private async publishOne(record: OutboxMessageRecord): Promise<void> {
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

      const targets = this.routingPolicy.resolve(record.eventType);
      if (targets.includes('rabbitmq')) {
        await this.rabbitmqPublisher.publish(message);
      }
      if (targets.includes('kafka')) {
        await this.kafkaPublisher.publish(message);
      }
      if (targets.includes('sqs')) {
        await this.sqsPublisher.publish(message);
      }

      await this.outboxRepository.markPublished(record.id);
    } catch (err) {
      this.logger.error(
        `Failed to publish outbox message ${record.id} (${record.eventType}): ${(err as Error).message}`,
      );
      await this.outboxRepository.markFailed(record.id, (err as Error).message);
    }
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
