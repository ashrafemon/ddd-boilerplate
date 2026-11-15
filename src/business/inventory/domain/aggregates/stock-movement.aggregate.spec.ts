import { StockMovement, StockBalance, StockMovementRecorded } from './stock-movement.aggregate';
import { StockMovementType } from '../types/stock-movement.enum';

const recordInput = {
  grnLineId: 'grn-line-1',
  productId: 'product-1',
  quantity: 5,
  movementType: StockMovementType.GOODS_RECEIPT,
  sourceDocumentId: 'grn-1',
  sourceDocumentType: 'GRN',
  companyId: 'company-1',
  tenantId: 'tenant-1',
  actorId: 'user-1',
  effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
  reversalOfId: null,
};

describe('StockMovement', () => {
  it('records a movement and exposes its fields', () => {
    const movement = StockMovement.record(recordInput);
    expect(movement.productId).toBe('product-1');
    expect(movement.quantity).toBe(5);
    expect(movement.movementType).toBe(StockMovementType.GOODS_RECEIPT);
    expect(movement.sourceDocumentId).toBe('grn-1');
    expect(movement.companyId).toBe('company-1');
    expect(movement.tenantId).toBe('tenant-1');
    expect(movement.actorId).toBe('user-1');
    expect(movement.id.value).toBeTruthy();
  });

  it('raises a StockMovementRecorded event', () => {
    const movement = StockMovement.record(recordInput);
    const events = movement.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(StockMovementRecorded);
  });

  it('rejects a quantity below 1', () => {
    expect(() => StockMovement.record({ ...recordInput, quantity: 0 })).toThrow(
      'Stock movement quantity must be >= 1',
    );
  });
});

describe('StockBalance', () => {
  const props = {
    id: 'balance-1',
    productId: 'product-1',
    companyId: 'company-1',
    tenantId: 'tenant-1',
    quantity: 10,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('exposes its props', () => {
    const balance = StockBalance.instantiate(props, 1);
    expect(balance.productId).toBe('product-1');
    expect(balance.quantity).toBe(10);
    expect(balance.getVersion()).toBe(1);
  });

  it('adjusts the quantity and updatedAt', () => {
    const balance = StockBalance.instantiate({ ...props }, 1);
    const now = new Date('2026-02-01T00:00:00.000Z');
    balance.adjust(5, now);
    expect(balance.quantity).toBe(15);
    expect(balance.updatedAt).toEqual(now);
  });

  it('can be reconstituted', () => {
    const balance = StockBalance.reconstitute({ ...props }, 3);
    expect(balance.getVersion()).toBe(3);
  });
});
