import { GrnId } from '../../../domain/value-objects/grn.vos';

export class GrnReceivedIntegrationEvent {
  constructor(public readonly grnId: GrnId) {}
}
