import { Chunker } from '@shared-kernel/utils/chunker.util';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import {
  IntegrationMessage,
  MessagePublisher,
} from '@platform/messaging/ports/message-publisher.port';
import {
  KafkaPublisher,
  RabbitMqPublisher,
  SqsPublisher,
} from '@platform/messaging/message-publisher.tokens';
import { InProcessEventBus } from '@platform/events/ports/event-bus.port';
import { domainEventRegistry } from '@business/shared-business/domain/registries/domain-event.registry';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { OutboxMessageRecord, OutboxRepository } from './ports/outbox-repository.port';
import { MessageRoutingPolicy } from '../events/message-routing.policy';

/** Aggregate groups published in parallel; events *within* a group stay ordered. */
const PARALLEL_PUBLISH_LIMIT = 10;

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private publishing = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly routingPolicy: MessageRoutingPolicy,
    private readonly eventBus: InProcessEventBus,
    private readonly requestContext: RequestContextPort,
    @Inject(RabbitMqPublisher) private readonly rabbitmqPublisher: MessagePublisher,
    @Inject(KafkaPublisher) private readonly kafkaPublisher: MessagePublisher,
    @Inject(SqsPublisher) private readonly sqsPublisher: MessagePublisher,
    private readonly configService: ConfigService,
  ) {}

  async publishPendingBatch(): Promise<number> {
    if (this.publishing) {
      return 0;
    }
    this.publishing = true;
    try {
      const { batchSize, maxAttempts } = this.config;
      const messages = await this.outboxRepository.claimBatch(batchSize, maxAttempts);

      // Preserve per-aggregate FIFO: group in claim order (createdAt asc) and
      // publish each aggregate's events sequentially; only distinct aggregates
      // run in parallel.
      const groups = new Map<string, OutboxMessageRecord[]>();
      for (const message of messages) {
        const key = `${message.aggregateType}:${message.aggregateId}`;
        const group = groups.get(key) ?? [];
        group.push(message);
        groups.set(key, group);
      }

      for (const groupChunk of Chunker.split([...groups.values()], PARALLEL_PUBLISH_LIMIT)) {
        await Promise.all(groupChunk.map(group => this.publishGroup(group)));
      }

      return messages.length;
    } finally {
      this.publishing = false;
    }
  }

  private async publishGroup(group: OutboxMessageRecord[]): Promise<void> {
    for (const record of group) {
      await this.publishOne(record);
    }
  }

  /** Re-claims rows whose PUBLISHING lease expired (worker crashed mid-batch). */
  async reconcileStaleClaims(): Promise<number> {
    const recovered = await this.outboxRepository.reconcileStaleClaims(this.config.claimLeaseMs);
    if (recovered > 0) {
      this.logger.warn(`Reclaimed ${recovered} outbox messages with expired publish leases`);
    }
    return recovered;
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
        tenantId: record.tenantId ?? undefined,
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

      await this.publishInProcess(record);
      await this.markPublishedSafely(record.id);
    } catch (err) {
      this.logger.error(
        `Failed to publish outbox message ${record.id} (${record.eventType}): ${FailureMessage.of(err)}`,
      );
      await this.markFailedSafely(record.id, FailureMessage.of(err));
    }
  }

  /**
   * Re-dispatch is best-effort in-process delivery: if it throws (a listener
   * bug), the brokers already hold the message — so do not push the row into
   * FAILED and re-publish duplicate broker traffic; surface via the log.
   */
  private async publishInProcess(record: OutboxMessageRecord): Promise<void> {
    const event = domainEventRegistry.rehydrate(record.eventType, record.payload, {
      eventId: record.headers?.['event-id'],
      occurredAt: record.occurredAt,
      correlationId: record.headers?.['correlation-id'],
      causationId: record.headers?.['causation-id'],
      headers: record.headers ?? undefined,
    });
    if (!event) {
      this.logger.warn(
        `No rehydrator registered for event type "${record.eventType}" — in-process dispatch skipped`,
      );
      return;
    }
    try {
      await this.requestContext.run(
        {
          tenantId: record.tenantId ?? undefined,
          organizationId: record.headers?.['organization-id'],
          correlationId: record.headers?.['correlation-id'],
        },
        () => this.eventBus.publish(event),
      );
    } catch (err) {
      this.logger.error(
        `In-process dispatch of ${record.eventType} (${record.id}) failed: ${FailureMessage.of(err)}`,
      );
    }
  }

  /**
   * A failed status write must not trigger a broker re-publish (the message
   * was delivered). The row ages out of its PUBLISHING lease and is
   * re-dispatched later — at-least-once, dedupe via the stable event-id header.
   */
  private async markPublishedSafely(id: string): Promise<void> {
    try {
      await this.outboxRepository.markPublished(id);
    } catch (err) {
      this.logger.error(
        `Outbox message ${id} was delivered but the publish status write failed: ${FailureMessage.of(err)}`,
      );
    }
  }

  private async markFailedSafely(id: string, error: string): Promise<void> {
    const { maxAttempts, retryBackoffBaseMs } = this.config;
    try {
      await this.outboxRepository.markFailed(id, error, {
        maxAttempts,
        backoffBaseMs: retryBackoffBaseMs,
      });
    } catch (err) {
      this.logger.error(
        `Outbox status write for failed message ${id} also failed (lease will recover it): ${FailureMessage.of(err)}`,
      );
    }
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
    return this.configService.getOutbox();
  }
}
