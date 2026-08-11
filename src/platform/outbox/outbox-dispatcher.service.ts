import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration.service';
import { LoggerPort } from '../../shared-kernel/ports/observability/logger.port';
import { MetricsPort } from '../../shared-kernel/ports/observability/metrics.port';
import { IntegrationMessage } from '../../shared-kernel/ports/messaging/integration-message';
import { MessagePublisherPort } from '../../shared-kernel/ports/messaging/message-publisher.port';
import { OutboxReadStorePort } from '../../shared-kernel/ports/outbox/outbox-read-store.port';
import { OutboxRecord } from '../../shared-kernel/ports/outbox/outbox-read-store.port';

/**
 * Polls the outbox table and publishes due events to the message transports
 * (RabbitMQ / Kafka / SQS) only after the business transaction has committed.
 *
 * Failed events are retried with exponential backoff and dead-lettered after
 * the configured maximum number of attempts.
 */
@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly readStore: OutboxReadStorePort,
    private readonly publisher: MessagePublisherPort,
    private readonly configuration: ConfigurationService,
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
  ) {}

  public onModuleInit(): void {
    this.metrics.registerGauge({ name: 'erp_outbox_pending_total', help: 'Pending outbox events' });
    this.metrics.registerCounter({
      name: 'erp_outbox_dispatched_total',
      help: 'Dispatched outbox events by status',
      labelNames: ['status'],
    });

    const { pollIntervalMs } = this.configuration.getOutbox();
    this.timer = setInterval(() => void this.dispatchOnce(), pollIntervalMs);
    this.timer.unref?.();
    this.logger.info('outbox-dispatcher-started', { pollIntervalMs });
  }

  public onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  public async dispatchOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { batchSize, maxAttempts } = this.configuration.getOutbox();
      const batch = await this.readStore.claimNextBatch(batchSize, new Date());

      for (const record of batch) {
        try {
          await this.publisher.publish(toIntegrationMessage(record));
          await this.readStore.markDelivered(record.id, new Date());
          this.metrics.incrementCounter('erp_outbox_dispatched_total', { status: 'delivered' });
        } catch (error) {
          const outcome = await this.readStore.markFailed(
            record.id,
            errorMessageOf(error),
            maxAttempts,
          );
          this.metrics.incrementCounter('erp_outbox_dispatched_total', {
            status: outcome.toLowerCase(),
          });
          this.logger.error('outbox-event-failed', {
            eventId: record.eventId,
            eventType: record.eventType,
            outcome,
            error: errorMessageOf(error),
          });
        }
      }

      this.metrics.setGauge('erp_outbox_pending_total', await this.readStore.countPending());
    } catch (error) {
      this.logger.error('outbox-dispatch-cycle-failed', { error: errorMessageOf(error) });
    } finally {
      this.running = false;
    }
  }
}

function toIntegrationMessage(record: OutboxRecord): IntegrationMessage {
  return {
    eventId: record.eventId,
    eventType: record.eventType,
    aggregateType: record.aggregateType,
    aggregateId: record.aggregateId,
    tenantId: record.tenantId,
    organizationId: record.organizationId ?? undefined,
    correlationId: record.correlationId ?? undefined,
    occurredAt: new Date().toISOString(),
    payload: record.payload,
  };
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
