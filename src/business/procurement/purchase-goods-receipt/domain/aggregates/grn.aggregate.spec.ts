import { GoodReceiptNote } from './grn.aggregate';
import { GrnId } from '../value-objects/grn-id.vo';
import { GrnProps, GrnStatus } from '../types/grn.types';

function makeGrn(
  status: GrnStatus = GrnStatus.DRAFT,
  lines: GrnProps['lines'] = [],
): GoodReceiptNote {
  const now = new Date();
  return GoodReceiptNote.instantiate(
    GrnId.fromString('grn-1'),
    {
      grnNumber: 'GRN-0001',
      purchaseOrderId: 'po-1',
      vendorId: 'v-1',
      status,
      currency: 'USD',
      lines,
      receivedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    1,
  );
}

describe('GoodReceiptNote aggregate', () => {
  describe('lines', () => {
    it('adds a received line and computes totals', () => {
      const grn = makeGrn();
      grn.addLine('p-1', 10, 4, 2.5);
      expect(grn.lines).toHaveLength(1);
      expect(grn.total).toBe(10);
    });

    it('merges a repeated product into the existing line', () => {
      const grn = makeGrn();
      grn.addLine('p-1', 10, 4, 2.5);
      grn.addLine('p-1', 10, 3, 2.5);
      expect(grn.lines).toHaveLength(1);
      expect(grn.lines[0].receivedQuantity).toBe(7);
    });

    it('rejects a non-positive received quantity', () => {
      const grn = makeGrn();
      expect(() => grn.addLine('p-1', 10, 0, 2.5)).toThrow();
    });

    it('rejects line changes outside DRAFT', () => {
      const grn = makeGrn(GrnStatus.RECEIVED);
      expect(() => grn.addLine('p-1', 10, 1, 2.5)).toThrow();
    });
  });

  describe('status transitions', () => {
    it('receives a draft GRN with lines', () => {
      const grn = makeGrn();
      grn.addLine('p-1', 10, 4, 2.5);
      grn.receive('receiver-1');
      expect(grn.status).toBe('RECEIVED');
      expect(grn.receivedAt).toBeInstanceOf(Date);
      expect(grn.receivedBy).toBe('receiver-1');
    });

    it('rejects receiving without lines', () => {
      const grn = makeGrn();
      expect(() => grn.receive()).toThrow('must have at least one line');
    });

    it('completes a received GRN and posts the receipt', () => {
      const grn = makeGrn();
      grn.addLine('p-1', 10, 4, 2.5);
      grn.receive();
      grn.complete('poster-1');
      expect(grn.status).toBe('COMPLETED');
      expect(grn.postedBy).toBe('poster-1');
      const events = grn.pullEvents();
      expect(events.some(e => e.constructor.name === 'GoodsReceiptPosted')).toBe(true);
    });

    it('rejects completing a draft GRN', () => {
      const grn = makeGrn();
      grn.addLine('p-1', 10, 4, 2.5);
      expect(() => grn.complete()).toThrow('Cannot complete GRN');
    });

    it('cancels a draft GRN', () => {
      const grn = makeGrn();
      grn.cancel('actor-1');
      expect(grn.status).toBe('CANCELLED');
      expect(grn.cancelledBy).toBe('actor-1');
    });

    it('rejects cancelling an already cancelled GRN', () => {
      const grn = makeGrn(GrnStatus.CANCELLED);
      expect(() => grn.cancel()).toThrow('already cancelled');
    });
  });

  describe('inspection', () => {
    it('records an accepted/rejected split on a received GRN', () => {
      const grn = makeGrn();
      grn.addLine('p-1', 10, 4, 2.5);
      grn.receive();
      grn.recordInspectionResult({
        lines: [{ productId: 'p-1', acceptedQuantity: 3, rejectedQuantity: 1 }],
      });
      expect(grn.lines[0].acceptedQuantity).toBe(3);
      expect(grn.lines[0].rejectedQuantity).toBe(1);
    });

    it('rejects a disposition that exceeds the received quantity', () => {
      const grn = makeGrn();
      grn.addLine('p-1', 10, 4, 2.5);
      grn.receive();
      expect(() =>
        grn.recordInspectionResult({
          lines: [{ productId: 'p-1', acceptedQuantity: 4, rejectedQuantity: 1 }],
        }),
      ).toThrow('Received quantity exceeds expected quantity');
    });

    it('rejects inspection on a draft GRN', () => {
      const grn = makeGrn();
      grn.addLine('p-1', 10, 4, 2.5);
      expect(() =>
        grn.recordInspectionResult({
          lines: [{ productId: 'p-1', acceptedQuantity: 3, rejectedQuantity: 1 }],
        }),
      ).toThrow('Inspection can only be recorded');
    });
  });
});
