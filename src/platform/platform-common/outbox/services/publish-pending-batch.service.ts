import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { InProcessEventBus } from '@platform/platform-common/events/ports/in-process-event-bus.port';
import {
  MessageQueuePort,
  UnsupportedBrokerTargetError,
} from '@platform/platform-common/messaging/ports/message-queue.port';
import { PrismaOutboxRepository } from '../repositories/prisma-outbox.repository';
import {
  BrokerTarget,
  DEFAULT_BROKER_TARGET,
  OutboxClaimedRecord,
  OutboxEnvelope,
} from '../types/outbox.types';

/**
 * Service: dispatch one claimed outbox row — publish to the broker named by the
 * envelope, then emit in-process on the same envelope, then CAS-settle.
 *
 * Extracted from `PublishPendingBatchUseCase` so the use case keeps a single
 * `execute()` entry point (claim → dispatch each row via this service).
 */
@Injectable()
export class PublishPendingBatchService {
  private readonly logger = new Logger(PublishPendingBatchService.name);

  constructor(
    private readonly repository: PrismaOutboxRepository,
    private readonly messageQueue: MessageQueuePort,
    private readonly eventBus: InProcessEventBus,
    private readonly requestContext: RequestContextPort,
    private readonly config: ConfigService,
  ) {}

  async dispatchOne(record: OutboxClaimedRecord, maxAttempts: number): Promise<void> {
    const envelope = this.toEnvelope(record);

    try {
      await this.messageQueue.publish(envelope);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);

      if (err instanceof UnsupportedBrokerTargetError) {
        this.logger.error(
          `Parking outbox message ${record.id} (${record.eventType}) as FAILED: ${reason}`,
        );
        await this.repository.markPermanentlyFailed(record.id, record.claimToken, reason);
        return;
      }

      await this.settleFailure(record, reason, maxAttempts);
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
        `In-process dispatch of ${record.eventType} (${record.id}) failed: ${err instanceof Error ? err.message : String(err)}`,
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
      aggregateVersion: record.aggregateVersion ?? undefined,
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
