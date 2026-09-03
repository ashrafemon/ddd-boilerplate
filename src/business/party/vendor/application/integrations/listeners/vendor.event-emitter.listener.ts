import { VendorCreated } from '@business/party/vendor/domain/domain-events/vendor.created.event';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class VendorEventEmitterListener {
  private readonly logger = new Logger(VendorEventEmitterListener.name);

  @OnEvent('VendorCreated')
  onVendorCreated(event: VendorCreated): void {
    this.logger.log(`[EventEmitter] Vendor ${event.vendorId.toString()} created`);
  }
}