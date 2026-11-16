import { GrnLineAdded } from './grn.line-added.event';
import { GrnId } from '../value-objects/grn-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('GrnLineAdded', () => {
  it('captures its payload as a domain event', () => {
    const event = new GrnLineAdded(GrnId.fromString('grn-1'), 'p-1');
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.productId).toBe('p-1');
  });
});
