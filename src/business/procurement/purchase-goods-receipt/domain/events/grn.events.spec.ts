import { GrnId } from '../value-objects/grn-id.vo';
import { GrnCancelled } from './grn.cancelled.event';
import { GrnCompleted } from './grn.completed.event';
import { GrnCreated } from './grn.created.event';
import { GrnLineAdded } from './grn.line-added.event';
import { GoodsReceiptPosted } from './grn.posted.event';
import { GrnReceived } from './grn.received.event';
import { GoodsReceiptReversed } from './grn.reversed.event';

const grnId = GrnId.fromString('11111111-1111-1111-1111-111111111111');

const postedLines = [{ grnLineId: 'l1', productId: 'p1', acceptedQuantity: 5, unitPrice: 100 }];

describe('GRN domain events', () => {
  it.each([
    ['GrnCreated', () => new GrnCreated(grnId, 'GRN-1', 'po-1')],
    ['GrnReceived', () => new GrnReceived(grnId)],
    ['GrnCompleted', () => new GrnCompleted(grnId)],
    ['GrnCancelled', () => new GrnCancelled(grnId)],
    ['GrnLineAdded', () => new GrnLineAdded(grnId, 'p1')],
    ['GoodsReceiptPosted', () => new GoodsReceiptPosted('g1', 'po-1', postedLines)],
    ['GoodsReceiptReversed', () => new GoodsReceiptReversed('g2', 'g1', 'po-1', postedLines)],
  ])('%s carries domain-event metadata', (_name, factory) => {
    const event = factory();
    expect(event.eventId).toBeTruthy();
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.version).toBe(1);
  });

  it('GrnCreated exposes number and purchase order', () => {
    const event = new GrnCreated(grnId, 'GRN-1', 'po-1');
    expect(event.grnNumber).toBe('GRN-1');
    expect(event.purchaseOrderId).toBe('po-1');
    expect(event.grnId.value).toBe(grnId.value);
  });

  it('GrnLineAdded exposes the productId', () => {
    const event = new GrnLineAdded(grnId, 'p9');
    expect(event.productId).toBe('p9');
  });

  it('GoodsReceiptPosted carries the accepted lines', () => {
    const event = new GoodsReceiptPosted('g1', 'po-1', postedLines);
    expect(event.lines).toEqual(postedLines);
    expect(event.purchaseOrderId).toBe('po-1');
  });

  it('GoodsReceiptReversed links the original', () => {
    const event = new GoodsReceiptReversed('g2', 'g1', 'po-1', postedLines);
    expect(event.reversalOfId).toBe('g1');
    expect(event.grnId).toBe('g2');
  });
});
