import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MessageEnvelope } from '@platform/events/ports/in-process-event-bus.port';

/**
 * In-process listener for Vendor domain events via @nestjs/event-emitter.
 * Receives the canonical envelope; the business payload is `message.payload`.
 */
@Injectable()
export class VendorEventEmitterListener {
  private readonly logger = new Logger(VendorEventEmitterListener.name);

  @OnEvent('VendorCreated')
  onVendorCreated(message: MessageEnvelope): void {
    this.logger.log(`[EventEmitter] VendorCreated received for ${message.aggregateId}`);
  }
}
