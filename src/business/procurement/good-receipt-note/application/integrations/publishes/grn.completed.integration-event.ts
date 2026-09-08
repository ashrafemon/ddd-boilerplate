import { GrnId } from '../../../domain/value-objects/grn.vos';

export class GrnCompletedIntegrationEvent {
  constructor(public readonly grnId: GrnId) {}
}
