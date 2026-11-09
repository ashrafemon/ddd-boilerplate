import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import type { OutboxEnvelope } from '@platform/platform-common/outbox/outbox.types';
import { InboxPort } from '@platform/platform-common/inbox/ports/inbox.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { GenerateRecurringPurchaseOrderUseCase } from '../../../application/usecases/generate-recurring-purchase-order.usecase';
import { RecurringOccurrenceRequestedPayload } from '../../../domain/types/recurring-occurrence.types';

const EXCHANGE = 'erp.events';
const RECURRING_QUEUE = 'recurring-occurrence.purchase-order.erp';

@Injectable()
export class RecurringOccurrenceRequestedRabbitMQListener {
  private readonly logger = new Logger(RecurringOccurrenceRequestedRabbitMQListener.name);

  constructor(
    private readonly generateRecurringPurchaseOrder: GenerateRecurringPurchaseOrderUseCase,
    private readonly inbox: InboxPort,
    private readonly requestContext: RequestContextPort,
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

    const tenantId = message.tenantId ?? '';
    const companyId = message.companyId ?? '';

    await this.requestContext.run({ tenantId, companyId }, async () => {
      const delivery = await this.inbox.receive({
        tenantId,
        companyId,
        consumer: 'RecurringOccurrenceRequestedRabbitMQListener',
        messageId: message.eventId,
        messageType: 'RecurringOccurrenceRequested',
        payload: message.payload,
        correlationId: message.correlationId,
        causationId: message.causationId,
      });

      if (delivery.status !== 'ACQUIRED') {
        return;
      }

      try {
        this.logger.log(
          `[RabbitMQ] RecurringOccurrenceRequested received for execution ${payload.executionId}`,
        );
        await this.generateRecurringPurchaseOrder.execute(payload);
        await this.inbox.complete({ reservation: delivery.reservation });
      } catch (err) {
        this.logger.error(`Recurring PO generation failed: ${(err as Error).message}`);
        await this.inbox.fail({
          reservation: delivery.reservation,
          lastError: (err as Error).message,
        });
        throw err;
      }
    });
  }
}
