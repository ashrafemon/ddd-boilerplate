import { Injectable, OnModuleInit } from '@nestjs/common';
import { IntegrationMessage } from '../../../../shared-kernel/ports/messaging/integration-message';
import { IntegrationMessageRouter } from '../../../../platform/messaging/integration-message-router';
import { IntegrationEventHandler } from '../../../../shared-kernel/ports/messaging/integration-event-handler.port';
import { LoggerPort } from '../../../../shared-kernel/ports/observability/logger.port';
import { MetricsPort } from '../../../../shared-kernel/ports/observability/metrics.port';
import { PurchaseOrderApprovedEvent } from '../../domain/event/purchase-order-approved.event';

/**
 * Consumer-side handler demonstrating the async event flow:
 *
 *   Event provider (RabbitMQ/Kafka/SQS)
 *     → ErpRabbitMqConsumer / KafkaConsumerService / SqsConsumerService
 *     → IntegrationMessageProcessor (context + inbox idempotency)
 *     → this handler
 *     → application ports of downstream modules.
 *
 * In a full ERP, the handler would resolve the Inventory module's public port
 * through ModulePortAccessor and reserve stock for the approved order. This
 * module keeps the handler as the canonical pattern and records the event.
 */
@Injectable()
export class PurchaseOrderApprovedIntegrationHandler
  implements IntegrationEventHandler, OnModuleInit
{
  public readonly eventType = PurchaseOrderApprovedEvent.EVENT_TYPE;

  constructor(
    private readonly router: IntegrationMessageRouter,
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
  ) {}

  public onModuleInit(): void {
    this.router.register(this);
    this.metrics.registerCounter({
      name: 'erp_purchase_order_approved_events_total',
      help: 'Purchase order approved events handled by the integration handler',
      labelNames: ['status'],
    });
  }

  public async handle(message: IntegrationMessage): Promise<void> {
    this.metrics.incrementCounter('erp_purchase_order_approved_events_total', {
      status: 'handled',
    });
    this.logger.info('purchase-order-approved-event-handled', {
      aggregateId: message.aggregateId,
      tenantId: message.tenantId,
      organizationId: message.organizationId,
      correlationId: message.correlationId,
    });
  }
}
