import { GrnId } from '../../../domain/value-objects/grn.vos';

export class GrnLineAddedIntegrationEvent {
  constructor(
    public eventId: string,
    public eventType: 'grn.line-added',
    public occurredAt: string,
    public readonly grnId: GrnId,
    public readonly productId: string,
  ) {}
}
