import { GrnId } from '../../../domain/value-objects/grn.vos';

export class GrnCreatedIntegrationEvent {
  constructor(
    public eventId: string,
    public eventType: 'grn.created',
    public occurredAt: string,
    public readonly grnId: GrnId,
    public readonly grnNumber: string,
    public readonly purchaseOrderId: string,
  ) {}
}
