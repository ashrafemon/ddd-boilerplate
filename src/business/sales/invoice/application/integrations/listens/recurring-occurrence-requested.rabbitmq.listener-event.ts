import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import type { OutboxEnvelope } from '@platform/platform-common/outbox/outbox.types';
import { InboxPort } from '@platform/platform-common/inbox/ports/inbox.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { GenerateRecurringInvoiceUseCase } from '../../usecases/generate-recurring-invoice.usecase';
import { RecurringOccurrenceRequestedPayload } from '../../types/recurring-occurrence.types';

const EXCHANGE = 'erp.events';
const RECURRING_QUEUE = 'recurring-occurrence.invoice.erp';

@Injectable()
export class RecurringOccurrenceRequestedRabbitMQListener {
  private readonly logger = new Logger(RecurringOccurrenceRequestedRabbitMQListener.name);

  constructor(
    private readonly generateRecurringInvoice: GenerateRecurringInvoiceUseCase,
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
    if (payload.targetEntityType !== 'Invoice') {
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
        await this.generateRecurringInvoice.execute(payload);
        await this.inbox.complete({ reservation: delivery.reservation });
      } catch (err) {
        this.logger.error(`Recurring invoice generation failed: ${(err as Error).message}`);
        await this.inbox.fail({
          reservation: delivery.reservation,
          lastError: (err as Error).message,
        });
        throw err;
      }
    });
  }
}
