import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import type { OutboxEnvelope } from '@platform/outbox/outbox.types';
import { GenerateRecurringPurchaseOrderUseCase } from '../../usecases/generate-recurring-purchase-order.usecase';
import { RecurringOccurrenceRequestedPayload } from '../recurring-occurrence.types';

const EXCHANGE = 'erp.events';
const RECURRING_QUEUE = 'recurring-occurrence.purchase-order.erp';

/**
 * RabbitMQ listener for RecurringOccurrenceRequested (published by the
 * platform outbox). Delegates to the use case — no logic inline.
 */
@Injectable()
export class RecurringOccurrenceRequestedRabbitMQListener {
  private readonly logger = new Logger(RecurringOccurrenceRequestedRabbitMQListener.name);

  constructor(
    private readonly generateRecurringPurchaseOrder: GenerateRecurringPurchaseOrderUseCase,
  ) {}

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: 'RecurringOccurrenceRequested',
    queue: RECURRING_QUEUE,
    queueOptions: { durable: true },
  })
  async onRecurringOccurrenceRequested(message: OutboxEnvelope): Promise<void> {
    if (message.eventType !== 'RecurringOccurrenceRequested') {
      return;
    }
    const payload = message.payload as unknown as RecurringOccurrenceRequestedPayload;
    if (payload.targetEntityType !== 'PurchaseOrder') {
      return;
    }
    this.logger.log(
      `[RabbitMQ] RecurringOccurrenceRequested received for execution ${payload.executionId}`,
    );
    await this.generateRecurringPurchaseOrder.execute(payload);
  }
}
