import { PriceListId } from '../value-objects/price-list-id.vo';
import { PriceListActivated } from './price-list-activated.event';
import { PriceListArchived } from './price-list-archived.event';
import { PriceListCreated } from './price-list-created.event';
import { PriceListDeactivated } from './price-list-deactivated.event';
import { PriceListLineAdded } from './price-list-line-added.event';
import { PriceListLineRemoved } from './price-list-line-removed.event';
import { PriceListLineUpdated } from './price-list-line-updated.event';
import { PriceListUpdated } from './price-list-updated.event';

const plId = PriceListId.fromString('11111111-1111-1111-1111-111111111111');

describe('PriceList domain events', () => {
  it.each([
    ['PriceListCreated', () => new PriceListCreated(plId, 'List', 'L1', 'USD')],
    ['PriceListUpdated', () => new PriceListUpdated(plId, 'N', 'C', 'USD', new Date(), null)],
    ['PriceListActivated', () => new PriceListActivated(plId)],
    ['PriceListDeactivated', () => new PriceListDeactivated(plId)],
    ['PriceListArchived', () => new PriceListArchived(plId)],
    ['PriceListLineAdded', () => new PriceListLineAdded(plId, 'p1')],
    ['PriceListLineUpdated', () => new PriceListLineUpdated(plId, 'p1')],
    ['PriceListLineRemoved', () => new PriceListLineRemoved(plId, 'p1')],
  ])('%s carries domain-event metadata', (_name, factory) => {
    const event = factory();
    expect(event.eventId).toBeTruthy();
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.version).toBe(1);
  });

  it('PriceListCreated exposes name, code and currency', () => {
    const event = new PriceListCreated(plId, 'List', 'L1', 'USD');
    expect(event.name).toBe('List');
    expect(event.code).toBe('L1');
    expect(event.currency).toBe('USD');
  });

  it('PriceListLineAdded exposes the productId', () => {
    const event = new PriceListLineAdded(plId, 'p9');
    expect(event.productId).toBe('p9');
  });

  it('PriceListUpdated carries nullable changed fields', () => {
    const event = new PriceListUpdated(plId, null, 'L2', null, null, new Date());
    expect(event.name).toBeNull();
    expect(event.code).toBe('L2');
    expect(event.effectiveTo).toBeInstanceOf(Date);
  });
});
