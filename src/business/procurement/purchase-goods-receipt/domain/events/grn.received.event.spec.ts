import { GrnReceived } from './grn.received.event';
import { GrnId } from '../value-objects/grn-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('GrnReceived', () => {
  it('captures its payload as a domain event', () => {
    const event = new GrnReceived(GrnId.fromString('grn-1'));
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.grnId.toString()).toBe('grn-1');
  });
});
