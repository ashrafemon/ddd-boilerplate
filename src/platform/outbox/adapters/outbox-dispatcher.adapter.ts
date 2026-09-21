import { Chunker } from '@shared-kernel/utils/chunker.util';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { MessagePublisher } from '@platform/messaging/ports/message-publisher.port';
import { EventBusPort } from '../../events/ports/event-bus.port';
import { MessageRoutingPolicy } from '../../events/message-routing.policy';
import { outboxEventRegistry } from '../../events/registries/outbox-event.registry';
import { ClaimOutboxMessagesUseCase } from '../usecases/claim-outbox-messages.usecase';
import { MarkOutboxPublishedUseCase } from '../usecases/mark-outbox-published.usecase';
import { MarkOutboxFailedUseCase } from '../usecases/mark-outbox-failed.usecase';
import { OutboxClaimedRecord } from '../outbox.types';

/** Aggregate groups published in parallel; events *within* a group stay ordered. */
const PARALLEL_PUBLISH_LIMIT = 10;

/**
 * Background dispatcher adapter — connects Outbox to EventBusPort and MessageQueuePort.
 *
 * Claims batches, publishes to brokers and the in-process bus, then settles
 * each message via CAS (claimToken + version).
 */
@Injectable()
export class OutboxDispatcherAdapter {
  private readonly logger = new Logger(OutboxDispatcherAdapter.name);
  private dispatching = false;

  constructor(
    private readonly claimMessages: ClaimOutboxMessagesUseCase,
    private readonly markPublished: MarkOutboxPublishedUseCase,
    private readonly markFailed: MarkOutboxFailedUseCase,
    private readonly routingPolicy: MessageRoutingPolicy,
    private readonly eventBus: EventBusPort,
    private readonly requestContext: RequestContextPort,
    private readonly messagePublisher: MessagePublisher,
    private readonly configService: ConfigService,
  ) {}

  async dispatchPendingBatch(): Promise<number> {
    if (this.dispatching) {
      return 0;
    }
    this.dispatching = true;
    try {
      const { batchSize, maxAttempts } = this.config;
      const messages = await this.claimMessages.execute({ batchSize, maxAttempts });

      // Preserve per-aggregate FIFO: group in claim order (createdAt asc) and
      // publish each aggregate's events sequentially; only distinct aggregates
      // run in parallel.
      const groups = new Map<string, OutboxClaimedRecord[]>();
      for (const message of messages) {
        const key = `${message.aggregateType}:${message.aggregateId}`;
        const group = groups.get(key) ?? [];
        group.push(message);
        groups.set(key, group);
      }

      for (const groupChunk of Chunker.split([...groups.values()], PARALLEL_PUBLISH_LIMIT)) {
        await Promise.all(groupChunk.map(group => this.dispatchGroup(group)));
      }

      return messages.length;
    } finally {
      this.dispatching = false;
    }
  }

  private async dispatchGroup(group: OutboxClaimedRecord[]): Promise<void> {
    for (const record of group) {
      await this.dispatchOne(record);
    }
  }

  private async dispatchOne(record: OutboxClaimedRecord): Promise<void> {
    try {
      const targets = this.routingPolicy.resolve(record.eventType);
      const messagePayload = {
        eventType: record.eventType,
        aggregateType: record.aggregateType,
        aggregateId: record.aggregateId,
        payload: record.payload,
        headers: record.headers ?? undefined,
        occurredAt: record.occurredAt,
        correlationId: record.correlationId ?? record.headers?.['correlation-id'],
        causationId: record.causationId ?? record.headers?.['causation-id'],
        tenantId: record.tenantId ?? undefined,
      };

      if (targets.includes('rabbitmq') || targets.includes('kafka') || targets.includes('sqs')) {
        await this.messagePublisher.publish(messagePayload);
      }

      await this.dispatchInProcess(record);
      await this.markPublished.execute(record.id, record.claimToken);
    } catch (err) {
      this.logger.error(
        `Failed to dispatch outbox message ${record.id} (${record.eventType}): ${FailureMessage.of(err)}`,
      );
      await this.markFailedSafely(record, FailureMessage.of(err));
    }
  }

  /**
   * Re-dispatch is best-effort in-process delivery: if it throws (a listener
   * bug), the brokers already hold the message — so do not push the row into
   * FAILED and re-publish duplicate broker traffic; surface via the log.
   */
  private async dispatchInProcess(record: OutboxClaimedRecord): Promise<void> {
    const event = outboxEventRegistry.rehydrate(record.eventType, record.payload, {
      eventId: record.eventId,
      occurredAt: record.occurredAt,
      correlationId: record.correlationId ?? record.headers?.['correlation-id'],
      causationId: record.causationId ?? record.headers?.['causation-id'],
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
          organizationId: record.organizationId ?? record.headers?.['organization-id'],
          correlationId: record.correlationId ?? record.headers?.['correlation-id'],
        },
        async () => {
          await this.eventBus.publish({
            eventId: record.eventId,
            eventType: record.eventType,
            eventVersion: record.eventVersion,
            tenantId: record.tenantId ?? undefined,
            organizationId: record.organizationId ?? undefined,
            aggregateType: record.aggregateType,
            aggregateId: record.aggregateId,
            payload: record.payload,
            occurredAt: record.occurredAt,
            correlationId: record.correlationId ?? record.headers?.['correlation-id'],
            causationId: record.causationId ?? record.headers?.['causation-id'],
            headers: record.headers ?? undefined,
          });
        },
      );
    } catch (err) {
      this.logger.error(
        `In-process dispatch of ${record.eventType} (${record.id}) failed: ${FailureMessage.of(err)}`,
      );
    }
  }

  private async markFailedSafely(record: OutboxClaimedRecord, error: string): Promise<void> {
    const { maxAttempts, retryBackoffBaseMs } = this.config;
    const availableAt = new Date(
      Date.now() + retryBackoffBaseMs * Math.pow(2, record.attempts - 1),
    );

    await this.markFailed.execute(record.id, record.claimToken, error, availableAt, maxAttempts);
  }

  private get config() {
    return this.configService.getOutbox();
  }
}
