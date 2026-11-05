import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { InProcessEventBus } from '@platform/events/ports/in-process-event-bus.port';
import { MessageQueuePort } from '@platform/messaging/ports/message-queue.port';
import { PrismaOutboxRepository } from '../repositories/prisma-outbox.repository';
import {
  BrokerTarget,
  DEFAULT_BROKER_TARGET,
  OutboxClaimedRecord,
  OutboxEnvelope,
} from '../outbox.types';

/**
 * Use case: publish a batch of pending outbox messages.
 *
 * claimBatch (SKIP LOCKED + lease clause) → publish to the broker named by the
 * envelope → emit in-process on the same envelope → CAS-settle each row.
 * Publish errors keep the row PENDING with exponential backoff; exhausted rows
 * park DEAD_LETTER. No reconciler — a crashed owner's lease simply expires and
 * the next tick reclaims it through the same clause.
 */
@Injectable()
export class PublishPendingBatchUseCase {
  private readonly logger = new Logger(PublishPendingBatchUseCase.name);
  private dispatching = false;

  constructor(
    private readonly repository: PrismaOutboxRepository,
    private readonly messageQueue: MessageQueuePort,
    private readonly eventBus: InProcessEventBus,
    private readonly requestContext: RequestContextPort,
    private readonly config: ConfigService,
  ) {}

  async execute(): Promise<number> {
    if (this.dispatching) {
      return 0;
    }
    this.dispatching = true;
    try {
      const { batchSize, maxAttempts, claimLeaseMs } = this.config.getOutbox();
      const messages = await this.repository.claimBatch({
        batchSize,
        maxAttempts,
        claimLeaseMs,
      });

      for (const message of messages) {
        await this.dispatchOne(message, maxAttempts);
      }

      return messages.length;
    } finally {
      this.dispatching = false;
    }
  }

  private async dispatchOne(record: OutboxClaimedRecord, maxAttempts: number): Promise<void> {
    const envelope = this.toEnvelope(record);

    try {
      await this.messageQueue.publish(envelope);
    } catch (err) {
      await this.settleFailure(record, FailureMessage.of(err), maxAttempts);
      return;
    }

    await this.emitInProcess(record, envelope);
    await this.repository.markPublished(record.id, record.claimToken);
  }

  /**
   * In-process delivery is best-effort: the broker already holds the message,
   * so a listener bug must not push the row into retry (duplicate broker
   * traffic). Surface it on the log instead.
   */
  private async emitInProcess(
    record: OutboxClaimedRecord,
    envelope: OutboxEnvelope,
  ): Promise<void> {
    try {
      await this.requestContext.run(
        {
          tenantId: record.tenantId ?? undefined,
          companyId: record.companyId ?? undefined,
          correlationId: envelope.correlationId,
        },
        () => this.eventBus.emit(envelope),
      );
    } catch (err) {
      this.logger.error(
        `In-process dispatch of ${record.eventType} (${record.id}) failed: ${FailureMessage.of(err)}`,
      );
    }
  }

  private async settleFailure(
    record: OutboxClaimedRecord,
    error: string,
    maxAttempts: number,
  ): Promise<void> {
    this.logger.error(
      `Failed to dispatch outbox message ${record.id} (${record.eventType}): ${error}`,
    );

    const { retryBackoffBaseMs, retryMaxDelayMs } = this.config.getOutbox();
    const delay = Math.min(
      retryMaxDelayMs,
      retryBackoffBaseMs * Math.pow(2, Math.max(0, record.attempts - 1)),
    );

    await this.repository.markFailed(
      record.id,
      record.claimToken,
      error,
      new Date(Date.now() + delay),
      maxAttempts,
    );
  }

  private toEnvelope(record: OutboxClaimedRecord): OutboxEnvelope {
    return {
      eventId: record.eventId,
      eventType: record.eventType,
      eventVersion: record.eventVersion,
      tenantId: record.tenantId,
      companyId: record.companyId,
      aggregateType: record.aggregateType,
      aggregateId: record.aggregateId,
      payload: record.payload,
      headers: record.headers ?? undefined,
      occurredAt: record.occurredAt,
      correlationId: record.correlationId ?? record.headers?.['correlation-id'],
      causationId: record.causationId ?? record.headers?.['causation-id'],
      broker: this.resolveBroker(record),
    };
  }

  private resolveBroker(record: OutboxClaimedRecord): BrokerTarget {
    const header = record.headers?.['broker'];
    if (header === 'rabbitmq' || header === 'kafka' || header === 'sqs') {
      return header;
    }
    return DEFAULT_BROKER_TARGET;
  }
}
