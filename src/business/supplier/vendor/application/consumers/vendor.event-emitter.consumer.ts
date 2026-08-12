import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { VendorCreated } from '../../domain/events/vendor.events';

@Injectable()
export class VendorEventEmitterConsumer {
  private readonly logger = new Logger(VendorEventEmitterConsumer.name);

  @OnEvent('VendorCreated')
  onVendorCreated(event: VendorCreated): void {
    this.logger.log(`[EventEmitter] Vendor ${event.vendorId.toString()} created`);
  }
}
