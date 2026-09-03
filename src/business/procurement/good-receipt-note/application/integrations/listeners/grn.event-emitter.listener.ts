import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GrnCreated } from '../../../domain/events/grn.created.event';

@Injectable()
export class GrnEventEmitterListener {
  private readonly logger = new Logger(GrnEventEmitterListener.name);

  @OnEvent('GrnCreated')
  onGrnCreated(event: GrnCreated): void {
    this.logger.log(`[EventEmitter] GRN ${event.grnId.toString()} created`);
  }
}