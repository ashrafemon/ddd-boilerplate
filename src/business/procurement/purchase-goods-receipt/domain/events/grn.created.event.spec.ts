import { GrnCreated } from './grn.created.event';
import { GrnId } from '../value-objects/grn-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('GrnCreated', () => {
  it('captures its payload as a domain event', () => {
    const event = new GrnCreated(GrnId.fromString('grn-1'), 'GRN-1', 'po-1');
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.grnNumber).toBe('GRN-1');
    expect(event.purchaseOrderId).toBe('po-1');
  });
});
