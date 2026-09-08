import { GrnId } from '../../../domain/value-objects/grn.vos';

export class GrnCancelledIntegrationEvent {
  constructor(public readonly grnId: GrnId) {}
}
