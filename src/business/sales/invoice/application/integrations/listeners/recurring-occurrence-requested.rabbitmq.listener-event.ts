import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { IntegrationMessage } from '@platform/messaging/ports/message-publisher.port';
import { GenerateRecurringInvoiceUseCase } from '../../usecases/generate-recurring-invoice.usecase';
import { RecurringOccurrenceRequestedPayload } from '../recurring-occurrence.types';

const EXCHANGE = 'erp.events';
const RECURRING_QUEUE = 'recurring-occurrence.invoice.erp';

/**
 * RabbitMQ listener for RecurringOccurrenceRequested (published by the
 * platform outbox). Delegates to the use case — no logic inline.
 */
@Injectable()
export class RecurringOccurrenceRequestedRabbitMQListener {
  private readonly logger = new Logger(RecurringOccurrenceRequestedRabbitMQListener.name);

  constructor(private readonly generateRecurringInvoice: GenerateRecurringInvoiceUseCase) {}

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: 'RecurringOccurrenceRequested',
    queue: RECURRING_QUEUE,
    queueOptions: { durable: true },
  })
  async onRecurringOccurrenceRequested(message: IntegrationMessage): Promise<void> {
    if (message.eventType !== 'RecurringOccurrenceRequested') {
      return;
    }
    const payload = message.payload as unknown as RecurringOccurrenceRequestedPayload;
    if (payload.targetEntityType !== 'Invoice') {
      return;
    }
    this.logger.log(
      `[RabbitMQ] RecurringOccurrenceRequested received for execution ${payload.executionId}`,
    );
    await this.generateRecurringInvoice.execute(payload);
  }
}
