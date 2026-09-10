import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceCreated } from '../../../domain/events/invoice.created.event';

/**
 * In-process listener for Invoice domain events via @nestjs/event-emitter.
 * Registered as a provider (not a controller) using the @OnEvent decorator.
 */
@Injectable()
export class InvoiceEventEmitterListener {
  private readonly logger = new Logger(InvoiceEventEmitterListener.name);

  @OnEvent('InvoiceCreated')
  onInvoiceCreated(event: InvoiceCreated): void {
    this.logger.log(`[EventEmitter] Invoice ${event.invoiceNo.toString()} created`);
  }
}
