import { GrnFactory } from '../factories/grn.factory';
import { GrnStatus } from '../types/grn.types';
import { GrnReceived } from '../events/grn.received.event';
import { GrnCancelled } from '../events/grn.cancelled.event';

describe('GoodReceiptNote aggregate', () => {
  const create = () =>
    GrnFactory.create({
      grnNumber: 'GRN-00000001',
      purchaseOrderId: 'po-1',
      vendorId: 'vendor-1',
      currency: 'USD',
      createdBy: 'user-1',
      lines: [{ productId: 'p1', orderedQuantity: 10, receivedQuantity: 4, unitPrice: 2.5 }],
    });

  it('creates a DRAFT with snapshotted lines, actor and null reversal link', () => {
    const grn = create();
    expect(grn.status).toBe(GrnStatus.DRAFT);
    expect(grn.lines).toHaveLength(1);
    expect(grn.lines[0].acceptedQuantity).toBe(4); // accept = received by default
    expect(grn.lines[0].rejectedQuantity).toBe(0);
    expect(grn.createdBy).toBe('user-1');
    expect(grn.reversalOfId).toBeNull();
    expect(grn.receivedAt).toBeNull();
  });

  it('requires a purchase order to be created', () => {
    expect(() =>
      GrnFactory.create({
        grnNumber: 'G',
        purchaseOrderId: '',
        vendorId: 'v',
        currency: 'USD',
        lines: [],
      }),
    ).toThrow();
  });

  it('receive: DRAFT → RECEIVED, stamps receivedAt/receivedBy, raises GrnReceived', () => {
    const grn = create();
    grn.pullEvents();

    grn.receive('receiver-1');

    expect(grn.status).toBe(GrnStatus.RECEIVED);
    expect(grn.receivedAt).toBeInstanceOf(Date);
    expect(grn.receivedBy).toBe('receiver-1');
    expect(grn.pullEvents().some(e => e instanceof GrnReceived)).toBe(true);
  });

  it('receive without lines is rejected (GRN rules §5.3)', () => {
    const empty = GrnFactory.create({
      grnNumber: 'GRN-00000002',
      purchaseOrderId: 'po-1',
      vendorId: 'vendor-1',
      currency: 'USD',
      lines: [],
    });
    expect(() => empty.receive()).toThrow();
  });

  it('is editable in DRAFT only — lines cannot be added after receipt (B2)', () => {
    const grn = create();
    grn.addLine('p2', 3, 2, 1);
    expect(grn.lines).toHaveLength(2);

    grn.receive();
    expect(() => grn.addLine('p3', 1, 1, 1)).toThrow();
  });

  it('complete stamps postedBy; cancel stamps cancelledBy and raises GrnCancelled', () => {
    const grn = create();
    grn.receive();
    grn.pullEvents();
    grn.complete('poster-1');
    expect(grn.status).toBe(GrnStatus.COMPLETED);
    expect(grn.postedBy).toBe('poster-1');

    const other = create();
    other.pullEvents();
    other.cancel('cancel-actor');
    expect(other.status).toBe(GrnStatus.CANCELLED);
    expect(other.cancelledBy).toBe('cancel-actor');
    expect(other.pullEvents().some(e => e instanceof GrnCancelled)).toBe(true);
  });

  it('rejects invalid transitions (DRAFT → COMPLETED)', () => {
    const grn = create();
    expect(() => grn.complete()).toThrow();
  });

  describe('inspection split (Phase 3.2 / GRN-01, GRN-02)', () => {
    const received = () => {
      const grn = create();
      grn.receive();
      return grn;
    };

    it('records accepted/rejected on a RECEIVED document (accepted + rejected = received)', () => {
      const grn = received();
      grn.recordInspectionResult({
        lines: [{ productId: 'p1', acceptedQuantity: 3, rejectedQuantity: 1 }],
      });
      expect(grn.lines[0].acceptedQuantity).toBe(3);
      expect(grn.lines[0].rejectedQuantity).toBe(1);
    });

    it('rejects a split that does not reconcile with received (GRN-01)', () => {
      const grn = received();
      expect(() =>
        grn.recordInspectionResult({
          lines: [{ productId: 'p1', acceptedQuantity: 2, rejectedQuantity: 1 }],
        }),
      ).toThrow();
    });

    it('rejects negative dispositions (GRN-02)', () => {
      const grn = received();
      expect(() =>
        grn.recordInspectionResult({
          lines: [{ productId: 'p1', acceptedQuantity: 5, rejectedQuantity: -1 }],
        }),
      ).toThrow();
    });

    it('rejects inspection outside RECEIVED status', () => {
      const grn = create();
      expect(() =>
        grn.recordInspectionResult({
          lines: [{ productId: 'p1', acceptedQuantity: 4, rejectedQuantity: 0 }],
        }),
      ).toThrow();
    });

    it('rejects lines that are not on the document', () => {
      const grn = received();
      expect(() =>
        grn.recordInspectionResult({
          lines: [{ productId: 'nope', acceptedQuantity: 1, rejectedQuantity: 0 }],
        }),
      ).toThrow();
    });
  });

  describe('reversal factory (Phase 4.1 / GRN-05)', () => {
    const reversalInput = () => ({
      grnNumber: 'GRN-00000009',
      reversalOfId: 'original-grn',
      purchaseOrderId: 'po-1',
      vendorId: 'vendor-1',
      currency: 'USD',
      actorId: 'reverser-1',
      lines: [
        {
          productId: 'p1',
          orderedQuantity: 10,
          receivedQuantity: -4,
          acceptedQuantity: -4,
          rejectedQuantity: 0,
          unitPrice: 2.5,
        },
      ],
    });

    it('builds a COMPLETED compensation linked to the original with mirrored negative lines', () => {
      const reversal = GrnFactory.createReversal(reversalInput());
      expect(reversal.status).toBe(GrnStatus.COMPLETED);
      expect(reversal.reversalOfId).toBe('original-grn');
      expect(reversal.createdBy).toBe('reverser-1');
      expect(reversal.postedBy).toBe('reverser-1');
      expect(reversal.lines[0].receivedQuantity).toBe(-4);
      expect(reversal.lines[0].acceptedQuantity).toBe(-4);
      expect(reversal.receivedAt).toBeInstanceOf(Date);
    });

    it('requires a link to the original', () => {
      expect(() => GrnFactory.createReversal({ ...reversalInput(), reversalOfId: '' })).toThrow();
    });

    it('rejects a positive mirror', () => {
      expect(() =>
        GrnFactory.createReversal({
          ...reversalInput(),
          lines: [
            {
              productId: 'p1',
              orderedQuantity: 10,
              receivedQuantity: 4,
              acceptedQuantity: 4,
              rejectedQuantity: 0,
              unitPrice: 2.5,
            },
          ],
        }),
      ).toThrow();
    });

    it('rejects a mirror that does not reconcile (accepted + rejected = received)', () => {
      expect(() =>
        GrnFactory.createReversal({
          ...reversalInput(),
          lines: [
            {
              productId: 'p1',
              orderedQuantity: 10,
              receivedQuantity: -5,
              acceptedQuantity: -4,
              rejectedQuantity: 0,
              unitPrice: 2.5,
            },
          ],
        }),
      ).toThrow();
    });
  });
});
