import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaWriteService } from '../src/infrastructure/database/prisma/prisma-write.service';
import { createTestApp } from './utils/create-test-app';

/**
 * Receiving rollback and retry (spec §15 item 14, PUCHASING-PLAN §3).
 *
 * A command that fails must leave NOTHING behind: no partial receipt on the
 * purchase order, no state change on the GRN, no `GoodsReceiptPosted` event
 * published and no stock movement recorded. And the same command must be
 * retryable once the blocking condition is gone.
 *
 * Drives the real HTTP surface against the real database.
 */
describe('receiving rollback and retry (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaWriteService;

  const tenant = 'rollback-tenant';
  const company = '00000000-0000-4000-8000-00000000b011';

  const stamp = Date.now();
  const sku = `RB-SKU-${stamp}`;
  const vendorCode = `RB-V-${stamp}`;

  const ORDERED = 10;
  const EACH = 8;
  /** company_configs.overReceiptTolerance default is 0.1 → limit 11. */
  const LIMIT = ORDERED * 1.1;

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
        'x-user-id': 'rollback-user',
        'idempotency-key': `rb-${stamp}-${++idempotencySeq}`,
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

  /**
   * Wait for a condition. The stock movement is created by the ASYNC
   * outbox → in-process listener chain (the outbox polls every 10s), so the
   * assertion has to wait for it rather than read it synchronously.
   */
  const waitFor = async (
    probe: () => Promise<boolean>,
    what: string,
    timeoutMs = 30_000,
  ): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await probe()) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`timed out after ${timeoutMs}ms waiting for: ${what}`);
  };

  const receivedOnPo = async (): Promise<number> => {
    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { lines: true },
    });
    return po.lines.reduce((sum, l) => sum + Number(l.receivedQuantity), 0);
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
      const grns = await prisma.goodReceiptNote.findMany({
        where: { purchaseOrderId },
        select: { id: true },
      });
      const grnIds = grns.map(g => g.id);
      // The stock movements hang off the GRN documents, not the PO.
      await prisma.stockMovement.deleteMany({ where: { sourceDocumentId: { in: grnIds } } });
      await prisma.stockBalance.deleteMany({ where: { productId } });
      await prisma.goodReceiptNote.deleteMany({ where: { purchaseOrderId } });
      await prisma.purchaseOrder.deleteMany({ where: { id: purchaseOrderId } });
      await prisma.outboxMessage.deleteMany({
        where: { OR: [{ aggregateId: purchaseOrderId }, { aggregateId: { in: grnIds } }] },
      });
      await prisma.inboxMessage.deleteMany({
        where: { consumer: 'inventory.goods-receipt-posted' },
      });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (vendorId) await prisma.vendor.deleteMany({ where: { id: vendorId } });
  });

  async function seedMasterData(): Promise<void> {
    const vendor = await prisma.vendor.create({
      data: { code: vendorCode, name: 'Rollback Vendor', email: `rb-${stamp}@example.com` },
      select: { id: true },
    });
    vendorId = vendor.id;

    const product = await prisma.product.create({
      data: { sku, name: 'Rollback Product', unitPrice: 10, currency: 'USD' },
      select: { id: true },
    });
    productId = product.id;
  }

  async function createIssuedPo(): Promise<string> {
    const created = await call('POST', '/api/v1/purchase-orders', {
      vendorId,
      currency: 'USD',
    });
    expectStatus(created, 201, 'create purchase order');
    const id = (created.body as { data: { id: string } }).data.id;

    const added = await call('PATCH', `/api/v1/purchase-orders/${id}/lines`, {
      productId,
      quantity: ORDERED,
      unitPrice: 10,
      currency: 'USD',
    });
    expectStatus(added, 201, 'add line');

    for (const [method, step] of [
      ['PATCH', 'submit'],
      ['PATCH', 'approve'],
      ['PATCH', 'issue'],
    ] as const) {
      const res = await call(method, `/api/v1/purchase-orders/${id}/${step}`, {});
      expectStatus(res, 200, `purchase order ${step}`);
    }
    return id;
  }

  async function createReceivedGrn(quantity: number): Promise<string> {
    const created = await call('POST', '/api/v1/grn', {
      purchaseOrderId,
      vendorId,
      currency: 'USD',
      lines: [{ productId, orderedQuantity: ORDERED, receivedQuantity: quantity, unitPrice: 10 }],
    });
    expectStatus(created, 201, 'create grn');
    const id = (created.body as { data: { id: string } }).data.id;

    const received = await call('PATCH', `/api/v1/grn/${id}/receive`, {});
    expectStatus(received, 200, 'receive grn');
    return id;
  }

  it('rolls the whole transaction back when the over-receipt policy refuses it', async () => {
    await seedMasterData();
    purchaseOrderId = await createIssuedPo();

    const grnA = await createReceivedGrn(EACH);
    const grnB = await createReceivedGrn(EACH);

    // The first post succeeds: 8 of a limit of 11.
    const first = await call('PATCH', `/api/v1/grn/${grnA}/post`, {});
    expectStatus(first, 200, 'post first grn');
    expect(await receivedOnPo()).toBe(EACH);

    // The second would take the balance to 16 > 11 — refused with 422.
    const refused = await call('PATCH', `/api/v1/grn/${grnB}/post`, {});
    expectStatus(refused, 422, 'post over-receipt grn');

    // ROLLBACK: nothing of the refused post survived.
    expect(await receivedOnPo()).toBe(EACH); // the balance did not move

    const grnBRow = await prisma.goodReceiptNote.findUniqueOrThrow({
      where: { id: grnB },
      select: { status: true, postedBy: true },
    });
    expect(grnBRow.status).toBe('RECEIVED'); // not COMPLETED
    expect(grnBRow.postedBy).toBeNull();

    // No `GoodsReceiptPosted` was published for it.
    const events = await prisma.outboxMessage.findMany({
      where: { aggregateId: grnB },
      select: { eventType: true },
    });
    expect(events.map(e => e.eventType)).not.toContain('GoodsReceiptPosted');

    // And no stock movement was recorded for it.
    const movements = await prisma.stockMovement.count({
      where: { sourceDocumentId: grnB },
    });
    expect(movements).toBe(0);

    // The first GRN DID move stock — the rollback was scoped to the failing
    // command, not a blanket undo. The movement arrives through the async
    // outbox → inventory consumer chain, so wait for it.
    await waitFor(
      async () => (await prisma.stockMovement.count({ where: { sourceDocumentId: grnA } })) === 1,
      'the first GRN to produce a stock movement',
    );

    // …and the refused GRN still has none, now that the pipeline has run.
    expect(await prisma.stockMovement.count({ where: { sourceDocumentId: grnB } })).toBe(0);
  }, 60_000);

  it('lets the refused command be retried once the blocking condition is gone', async () => {
    await seedMasterData();
    purchaseOrderId = await createIssuedPo();

    const grnA = await createReceivedGrn(EACH);
    const grnB = await createReceivedGrn(EACH);

    const first = await call('PATCH', `/api/v1/grn/${grnA}/post`, {});
    expectStatus(first, 200, 'post first grn');

    const refused = await call('PATCH', `/api/v1/grn/${grnB}/post`, {});
    expectStatus(refused, 422, 'post over-receipt grn');

    // Wait for the receipt to be processed into a stock movement BEFORE
    // reversing — that is the realistic ordering (a receipt is processed
    // within seconds; a reversal is a human decision minutes later).
    await waitFor(
      async () => (await prisma.stockMovement.count({ where: { sourceDocumentId: grnA } })) === 1,
      'the first GRN to produce a stock movement',
    );

    // Reverse the first receipt: the balance returns to zero. The reversal is
    // a COMPENSATING document with its own id.
    const reversed = await call('PATCH', `/api/v1/grn/${grnA}/reverse`, {});
    expectStatus(reversed, 200, 'reverse first grn');
    const reversalId = (reversed.body as { data: { id: string } }).data.id;
    expect(await receivedOnPo()).toBe(0);

    // The SAME command now succeeds — the failure left nothing behind.
    const retried = await call('PATCH', `/api/v1/grn/${grnB}/post`, {});
    expectStatus(retried, 200, 'retry the refused post');
    expect(await receivedOnPo()).toBe(EACH);
    expect(await receivedOnPo()).toBeLessThanOrEqual(LIMIT);

    // The reversal produced its own compensating movement, on the reversal
    // document and linked back to the original movement (async chain).
    await waitFor(
      async () =>
        (
          await prisma.stockMovement.findMany({
            where: { sourceDocumentId: reversalId },
            select: { movementType: true, reversalOfId: true },
          })
        ).some(m => m.movementType === 'GOODS_RECEIPT_REVERSAL'),
      'the reversal to produce a compensating movement',
    );

    const compensations = await prisma.stockMovement.findMany({
      where: { sourceDocumentId: reversalId, movementType: 'GOODS_RECEIPT_REVERSAL' },
      select: { reversalOfId: true, quantity: true },
    });
    expect(compensations).toHaveLength(1);
    // It points back at the original GOODS_RECEIPT movement.
    expect(compensations[0].reversalOfId).not.toBeNull();
  }, 60_000);
});
