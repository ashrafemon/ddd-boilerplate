import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaWriteService } from '../src/infrastructure/database/prisma/prisma-write.service';
import { createTestApp } from './utils/create-test-app';

/**
 * Controlled amendment of an ISSUED purchase order (spec §4
 * "AmendPurchaseOrder", PO-06).
 *
 * An issued order is not freely editable: the amendment is what changes the
 * commercial terms, it records who / when / why / which fields, and it is
 * refused where it does not apply (a draft order, a line that already has a
 * receipt).
 *
 * Drives the real HTTP surface against the real database.
 */
describe('purchase order amendment (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaWriteService;

  const tenant = 'amend-tenant';
  const company = '00000000-0000-4000-8000-00000000a11d';

  const stamp = Date.now();
  const sku = `AMD-SKU-${stamp}`;
  const vendorCode = `AMD-V-${stamp}`;

  let idempotencySeq = 0;
  let productId: string;
  let vendorId: string;
  let purchaseOrderId: string;

  const call = async (method: 'POST' | 'PATCH' | 'GET', url: string, payload?: unknown) => {
    const res = await app.inject({
      method,
      url,
      headers: {
        'x-tenant-id': tenant,
        'x-company-id': company,
        'x-user-id': 'amend-user',
        'idempotency-key': `amd-${stamp}-${++idempotencySeq}`,
      },
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
    return { status: res.statusCode, body: parseJson(res.body) };
  };

  const parseJson = (raw: string): unknown => {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  };

  const expectStatus = (
    res: { status: number; body: unknown },
    expected: number,
    what: string,
  ): void => {
    if (res.status !== expected) {
      throw new Error(
        `${what}: expected HTTP ${expected}, got ${res.status} — ${JSON.stringify(res.body)}`,
      );
    }
  };

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaWriteService);
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    if (purchaseOrderId) {
      await prisma.purchaseOrder.deleteMany({ where: { id: purchaseOrderId } });
      await prisma.outboxMessage.deleteMany({ where: { aggregateId: purchaseOrderId } });
      await prisma.auditLog.deleteMany({ where: { entityId: purchaseOrderId } });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (vendorId) await prisma.vendor.deleteMany({ where: { id: vendorId } });
  });

  async function seedMasterData(): Promise<void> {
    const vendor = await prisma.vendor.create({
      data: { code: vendorCode, name: 'Amend Vendor', email: `amd-${stamp}@example.com` },
      select: { id: true },
    });
    vendorId = vendor.id;

    const product = await prisma.product.create({
      data: { sku, name: 'Amend Product', unitPrice: 10, currency: 'USD' },
      select: { id: true },
    });
    productId = product.id;
  }

  /** A purchase order in the given status. */
  async function createPo(status: 'DRAFT' | 'ISSUED'): Promise<string> {
    const created = await call('POST', '/api/v1/purchase-orders', {
      vendorId,
      currency: 'USD',
    });
    expectStatus(created, 201, 'create purchase order');
    const id = (created.body as { data: { id: string } }).data.id;

    const added = await call('POST', `/api/v1/purchase-orders/${id}/lines`, {
      productId,
      quantity: 5,
      unitPrice: 10,
      currency: 'USD',
    });
    expectStatus(added, 201, 'add line');

    if (status === 'ISSUED') {
      for (const [method, step] of [
        ['PATCH', 'submit'],
        ['PATCH', 'approve'],
        ['POST', 'issue'],
      ] as const) {
        const res = await call(method, `/api/v1/purchase-orders/${id}/${step}`, {});
        expectStatus(res, 200, `purchase order ${step}`);
      }
    }
    return id;
  }

  it('amends an issued order and records the trail', async () => {
    await seedMasterData();
    purchaseOrderId = await createPo('ISSUED');

    const newDate = new Date('2030-06-01T00:00:00.000Z');
    const amended = await call('PATCH', `/api/v1/purchase-orders/${purchaseOrderId}/amend`, {
      expectedDeliveryDate: newDate.toISOString(),
      lineUnitPrices: { [productId]: 12.5 },
      reason: 'Supplier price increase agreed by phone',
    });
    expectStatus(amended, 200, 'amend issued purchase order');

    const row = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { lines: true },
    });

    // The order stays ISSUED — an amendment is not a transition.
    expect(row.status).toBe('ISSUED');
    // The commercial terms moved…
    expect(row.expectedDeliveryDate?.toISOString()).toBe(newDate.toISOString());
    expect(Number(row.lines[0].unitPrice)).toBe(12.5);
    expect(Number(row.lines[0].total)).toBe(62.5); // 5 x 12.50
    // …and the trail says who, when and why.
    expect(row.amendedBy).toBe('amend-user');
    expect(row.amendmentReason).toBe('Supplier price increase agreed by phone');
    expect(row.amendedAt).not.toBeNull();

    // The audit trail carries the fields that actually changed.
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: purchaseOrderId, action: 'purchase-order.amend' },
    });
    expect(audit).not.toBeNull();
    const changes = audit?.changes as { lineUnitPrices?: Record<string, string>; reason?: string };
    expect(changes.reason).toBe('Supplier price increase agreed by phone');
    expect(Object.keys(changes.lineUnitPrices ?? {})).toHaveLength(1);
  }, 60_000);

  it('refuses to amend an order that is not issued', async () => {
    await seedMasterData();
    purchaseOrderId = await createPo('DRAFT');

    const amended = await call('PATCH', `/api/v1/purchase-orders/${purchaseOrderId}/amend`, {
      expectedDeliveryDate: new Date('2030-06-01T00:00:00.000Z').toISOString(),
      reason: 'too early',
    });
    expectStatus(amended, 422, 'amend a draft purchase order');

    const row = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      select: { amendedBy: true, amendmentReason: true },
    });
    expect(row.amendedBy).toBeNull();
    expect(row.amendmentReason).toBeNull();
  }, 60_000);

  it('requires a reason', async () => {
    await seedMasterData();
    purchaseOrderId = await createPo('ISSUED');

    // The DTO rejects an empty reason before the use case runs.
    const amended = await call('PATCH', `/api/v1/purchase-orders/${purchaseOrderId}/amend`, {
      expectedDeliveryDate: new Date('2030-06-01T00:00:00.000Z').toISOString(),
      reason: '',
    });
    expectStatus(amended, 400, 'amend without a reason');
  }, 60_000);
});
