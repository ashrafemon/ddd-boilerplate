import { PrismaGrnMapper } from './prisma-grn.mapper';
import { GrnFactory } from '../../domain/factories/grn.factory';
import { GrnStatus } from '../../domain/types/grn.types';

/**
 * Phase 0.8: header ↔ row round-trip. Guards the exact failures Phase 0 fixed —
 * lines must survive persistence (B1), the real version must thread through
 * (B6), and the Phase 1/2/4 columns (actors, reversal link) must not be lost.
 */
describe('PrismaGrnMapper', () => {
  const baseRow = {
    id: 'grn-1',
    grnNumber: 'GRN-00000001',
    purchaseOrderId: 'po-1',
    vendorId: 'vendor-1',
    status: 'RECEIVED',
    currency: 'USD',
    subtotal: 10,
    total: 10,
    receivedAt: new Date('2026-10-01T10:00:00.000Z'),
    reversalOfId: null as string | null,
    createdBy: 'creator-1',
    receivedBy: 'receiver-1',
    postedBy: null as string | null,
    cancelledBy: null as string | null,
    createdAt: new Date('2026-10-01T09:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    version: 3,
    lines: [
      {
        id: 'line-1',
        grnId: 'grn-1',
        productId: 'product-1',
        orderedQuantity: 10,
        receivedQuantity: 4,
        acceptedQuantity: 3,
        rejectedQuantity: 1,
        unitPrice: 2.5,
        total: 10,
      },
    ],
  };

  it('toDomain: threads header, actor, reversal and line fields plus the real version', () => {
    const grn = PrismaGrnMapper.toDomain(baseRow);

    expect(grn.id.toString()).toBe('grn-1');
    expect(grn.status).toBe(GrnStatus.RECEIVED);
    expect(grn.getVersion()).toBe(3);
    expect(grn.createdBy).toBe('creator-1');
    expect(grn.receivedBy).toBe('receiver-1');
    expect(grn.postedBy).toBeNull();
    expect(grn.reversalOfId).toBeNull();
    expect(grn.receivedAt?.toISOString()).toBe('2026-10-01T10:00:00.000Z');

    expect(grn.lines).toHaveLength(1);
    expect(grn.lines[0].productId).toBe('product-1');
    expect(grn.lines[0].orderedQuantity).toBe(10);
    expect(grn.lines[0].receivedQuantity).toBe(4);
    expect(grn.lines[0].acceptedQuantity).toBe(3);
    expect(grn.lines[0].rejectedQuantity).toBe(1);
    expect(grn.lines[0].unitPrice).toBe(2.5);
  });

  it('round-trip: toRow + toLinesCreateInput rehydrate the same aggregate (B1: lines persist)', () => {
    const original = PrismaGrnMapper.toDomain(baseRow);
    const header = PrismaGrnMapper.toRow(original);
    const lineRows = PrismaGrnMapper.toLinesCreateInput(original);

    // `version` is intentionally NOT in toRow (the repo CAS owns it) — the
    // row the update writes keeps the DB version under increment control.
    expect('version' in header).toBe(false);

    const rehydrated = PrismaGrnMapper.toDomain({
      ...header,
      lines: lineRows.map((line, index) => ({
        ...line,
        id: `line-${index + 1}`,
        grnId: original.id.toString(),
      })),
      version: 4,
    });

    expect(rehydrated.status).toBe(original.status);
    expect(rehydrated.createdBy).toBe('creator-1');
    expect(rehydrated.receivedBy).toBe('receiver-1');
    expect(rehydrated.receivedAt?.getTime()).toBe(original.receivedAt?.getTime());
    expect(rehydrated.lines).toHaveLength(1);
    expect(rehydrated.lines[0]).toMatchObject({
      productId: 'product-1',
      orderedQuantity: 10,
      receivedQuantity: 4,
      acceptedQuantity: 3,
      rejectedQuantity: 1,
    });
    expect(rehydrated.getVersion()).toBe(4);
  });

  it('toRow keeps the reversal link on a compensation document', () => {
    const reversal = GrnFactory.createReversal({
      grnNumber: 'GRN-00000002',
      reversalOfId: 'grn-1',
      purchaseOrderId: 'po-1',
      vendorId: 'vendor-1',
      currency: 'USD',
      actorId: 'reverser-1',
      lines: [
        {
          productId: 'product-1',
          orderedQuantity: 10,
          receivedQuantity: -4,
          acceptedQuantity: -4,
          rejectedQuantity: 0,
          unitPrice: 2.5,
        },
      ],
    });

    const row = PrismaGrnMapper.toRow(reversal);
    expect(row.reversalOfId).toBe('grn-1');
    expect(row.status).toBe('COMPLETED');
    expect(row.createdBy).toBe('reverser-1');
    expect(row.postedBy).toBe('reverser-1');

    const lines = PrismaGrnMapper.toLinesCreateInput(reversal);
    expect(lines[0].receivedQuantity).toBe(-4);
    expect(lines[0].acceptedQuantity).toBe(-4);
  });
});
