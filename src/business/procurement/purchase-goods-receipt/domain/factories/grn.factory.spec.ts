import { GrnFactory } from './grn.factory';
import { GrnStatus } from '../types/grn.enum';

describe('GrnFactory', () => {
  const baseInput = {
    grnNumber: 'GRN-00000001',
    purchaseOrderId: 'po-1',
    vendorId: 'vendor-1',
    currency: 'USD',
    lines: [
      { productId: 'prod-1', orderedQuantity: 10, receivedQuantity: 8, unitPrice: 500 },
      { productId: 'prod-2', orderedQuantity: 5, receivedQuantity: 5, unitPrice: 1000 },
    ],
  };

  it('creates DRAFT GRN with lines', () => {
    const grn = GrnFactory.create(baseInput);

    expect(grn.grnNumber).toBe('GRN-00000001');
    expect(grn.status).toBe(GrnStatus.DRAFT);
    expect(grn.lines).toHaveLength(2);
    // subtotal = sum of (receivedQuantity * unitPrice): 8*500 + 5*1000 = 4000 + 5000 = 9000 (in minor units / 100 = 90.00)
    expect(grn.subtotal).toBe(9000); // GrnTotalsService returns minor units sum
  });

  it('emits GrnCreated event on create', () => {
    const grn = GrnFactory.create(baseInput);
    const events = grn.pullEvents();
    expect(events).toHaveLength(1);
  });

  it('throws when purchaseOrderId is blank', () => {
    expect(() => GrnFactory.create({ ...baseInput, purchaseOrderId: '' })).toThrow(
      'Purchase order ID is required',
    );
  });

  it('throws when reversalOfId missing for reversal', () => {
    expect(() =>
      GrnFactory.createReversal({
        ...baseInput,
        reversalOfId: '',
        lines: baseInput.lines.map(l => ({
          productId: l.productId,
          orderedQuantity: l.orderedQuantity,
          receivedQuantity: l.receivedQuantity,
          acceptedQuantity: l.receivedQuantity,
          rejectedQuantity: 0,
          unitPrice: l.unitPrice,
        })),
      }),
    ).toThrow('Reversal requires reversalOfId');
  });

  it('creates COMPLETED reversal with mirrored quantities', () => {
    const grn = GrnFactory.createReversal({
      ...baseInput,
      grnNumber: 'GRN-00000002',
      reversalOfId: 'grn-original',
      lines: baseInput.lines.map(l => ({
        productId: l.productId,
        orderedQuantity: l.orderedQuantity,
        receivedQuantity: -l.receivedQuantity,
        acceptedQuantity: -l.receivedQuantity,
        rejectedQuantity: 0,
        unitPrice: l.unitPrice,
      })),
    });

    expect(grn.status).toBe(GrnStatus.COMPLETED);
    expect(grn.reversalOfId).toBe('grn-original');
    expect(grn.lines).toHaveLength(2);
  });
});
