import { StockMovementId } from '../value-objects/stock-movement-id.vo';
import { StockMovementType } from '../types/stock-movement.enum';
import { StockBalanceUpdated } from './stock-balance-updated.event';
import { StockMovementRecorded } from './stock-movement-recorded.event';

describe('Inventory domain events', () => {
  it('StockBalanceUpdated carries before/after quantities', () => {
    const event = new StockBalanceUpdated('p1', 'company-1', 'tenant-1', 10, 15);
    expect(event.productId).toBe('p1');
    expect(event.previousQuantity).toBe(10);
    expect(event.newQuantity).toBe(15);
    expect(event.eventId).toBeTruthy();
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.version).toBe(1);
  });

  it('StockMovementRecorded carries the movement details', () => {
    const movementId = StockMovementId.fromString('sm-1');
    const event = new StockMovementRecorded(
      movementId,
      'p1',
      5,
      StockMovementType.GOODS_RECEIPT,
      'grn-1',
      'GRN',
    );
    expect(event.movementId.value).toBe('sm-1');
    expect(event.quantity).toBe(5);
    expect(event.movementType).toBe(StockMovementType.GOODS_RECEIPT);
    expect(event.sourceDocumentId).toBe('grn-1');
    expect(event.sourceDocumentType).toBe('GRN');
  });
});
