import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { PrismaWriteService } from '../src/infrastructure/database/prisma/prisma-write.service';
import { configureHttp } from '../src/bootstrap/configure-http';

/**
 * PO-07 receiving concurrency (PURCHASING-PLAN §3.7).
 *
 * "Two concurrent receipts cannot exceed the permitted quantity" — the
 * spec's concurrency invariant (BusinessAggregate.md §6). The receiving
 * balance is guarded by a CAS on `(id, version)`: the second registration
 * blocks on the row lock, re-checks the predicate against the committed
 * version and matches zero rows → 409. It must never silently exceed the
 * over-receipt tolerance.
 *
 * This test drives the real HTTP surface against the real database, so it
 * exercises the request pipeline, the CLS transaction and the Postgres
 * locking semantics together. It is NOT a fake-based unit test: an
 * in-memory substitute cannot reproduce the production concurrency.
 *
 * Requires `docker compose up -d` + `.env` (see AGENTS.md).
 */
describe('PO-07 receiving concurrency (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaWriteService;

  const tenant = 'e2e-tenant';
  // The company id feeds a `uuid` column (company_configs.companyId), so it
  // must be a real UUID. No row exists for it — in single-tenant mode the
  // repository warns and falls back to the built-in defaults.
  const company = '00000000-0000-4000-8000-00000000e2ef';
  const headers = {
    'x-tenant-id': tenant,
    'x-company-id': company,
    'x-user-id': 'e2e-user',
  };

  /**
   * `@Idempotent()`-guarded routes need a client key. Every call gets a fresh
   * one, so a retry of the whole test never replays a stale reservation.
   */
  let idempotencySeq = 0;
  const idempotencyHeaders = () => ({
    ...headers,
    'idempotency-key': `e2e-${stamp}-${++idempotencySeq}`,
  });

  /** PO line quantity — deliberately small so two receipts can contest it. */
  const ORDERED = 10;
  /** Each GRN receives this much; jointly they exceed the tolerance. */
  const EACH = 8;
  /** company_configs.overReceiptTolerance default is 0.1 (10%). */
  const LIMIT = ORDERED * 1.1;

  const stamp = Date.now();
  const vendorCode = `E2E-V-${stamp}`;
  const sku = `E2E-SKU-${stamp}`;

  let vendorId: string;
  let productId: string;
  let purchaseOrderId: string;

  /** `JSON.parse` returns `any` — narrow it to `unknown` at the boundary. */
  const parseJson = (raw: string): unknown => {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  };

  const createJson = async (method: 'POST' | 'PATCH' | 'GET', url: string, payload?: unknown) => {
    const res = await app.inject({
      method,
      url,
      headers: idempotencyHeaders(),
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
    return { status: res.statusCode, body: parseJson(res.body) };
  };

  /** Assert an HTTP status, printing the response body when it does not match. */
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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    // The same routing setup main.ts applies: global prefix + URI versioning.
    configureHttp(app);
    await app.init();

    // The app's own write client — same pool and config as the code under test.
    prisma = app.get(PrismaWriteService);
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Fresh vendor + product for every run so the test is repeatable.
    const vendor = await prisma.vendor.create({
      data: { code: vendorCode, name: 'E2E Vendor', email: `e2e-${stamp}@example.com` },
      select: { id: true },
    });
    vendorId = vendor.id;

    const product = await prisma.product.create({
      data: { sku, name: 'E2E Product', unitPrice: 10, currency: 'USD' },
      select: { id: true },
    });
    productId = product.id;
  });

  afterEach(async () => {
    // Clean up the documents this test created (FK order: GRN → PO → master data).
    await prisma.goodReceiptNote.deleteMany({ where: { purchaseOrderId } });
    await prisma.purchaseOrder.deleteMany({ where: { id: purchaseOrderId } });
    await prisma.outboxMessage.deleteMany({ where: { aggregateId: { in: [purchaseOrderId] } } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.vendor.deleteMany({ where: { id: vendorId } });
  });

  async function createIssuedPurchaseOrder(): Promise<string> {
    const created = await createJson('POST', '/api/v1/purchase-orders', {
      vendorId,
      currency: 'USD',
    });
    expectStatus(created, 201, 'create purchase order');
    const id = (created.body as { data: { id: string } }).data.id;

    // Lines are added through their own command (POST /purchase-orders/:id/lines).
    const added = await createJson('POST', `/api/v1/purchase-orders/${id}/lines`, {
      productId,
      quantity: ORDERED,
      unitPrice: 10,
      currency: 'USD',
    });
    expectStatus(added, 201, 'add purchase order line');

    // DRAFT → SUBMITTED → APPROVED → ISSUED (the PO must be receiving-eligible).
    // submit/approve are PATCH transitions; issue is a POST command.
    for (const [method, step] of [
      ['PATCH', 'submit'],
      ['PATCH', 'approve'],
      ['POST', 'issue'],
    ] as const) {
      const res = await createJson(method, `/api/v1/purchase-orders/${id}/${step}`, {});
      expectStatus(res, 200, `purchase order ${step}`);
    }
    return id;
  }

  async function createReceivedGrn(quantity: number): Promise<string> {
    const created = await createJson('POST', '/api/v1/grn', {
      purchaseOrderId,
      vendorId,
      currency: 'USD',
      lines: [{ productId, orderedQuantity: ORDERED, receivedQuantity: quantity, unitPrice: 10 }],
    });
    expectStatus(created, 201, 'create purchase order');
    const id = (created.body as { data: { id: string } }).data.id;

    const received = await createJson('PATCH', `/api/v1/grn/${id}/receive`, {});
    expect(received.status).toBe(200);
    return id;
  }

  it('never lets two concurrent receipts jointly exceed the over-receipt limit', async () => {
    purchaseOrderId = await createIssuedPurchaseOrder();

    const grnA = await createReceivedGrn(EACH);
    const grnB = await createReceivedGrn(EACH);

    // Both GRNs are received; post them at the same time. Jointly they claim
    // 2 x EACH units against an ORDERED line whose limit is ORDERED x 1.1.
    const [resA, resB] = await Promise.all([
      createJson('POST', `/api/v1/grn/${grnA}/post`, {}),
      createJson('POST', `/api/v1/grn/${grnB}/post`, {}),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Exactly one post wins; the other is rejected — 409 (CAS lost the race)
    // or 422 (the over-receipt policy refused the balance).
    if (!(statuses[0] === 200 && [409, 422].includes(statuses[1]))) {
      throw new Error(
        `expected one post to win (200) and one to be rejected (409/422); got ` +
          JSON.stringify({ statuses, resA, resB }),
      );
    }

    // The authoritative balance records exactly ONE receipt — not two. Two
    // would be 16 units against a limit of 11.
    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { lines: true },
    });
    const received = po.lines.reduce((sum, l) => sum + Number(l.receivedQuantity), 0);
    expect(received).toBe(EACH);
    expect(received).toBeLessThanOrEqual(LIMIT);

    // Only the winning post moved the GRN to COMPLETED.
    const posted = await prisma.goodReceiptNote.count({
      where: { id: { in: [grnA, grnB] }, status: 'COMPLETED' },
    });
    expect(posted).toBe(1);
  }, 60_000);

  it('replays a repeated post of the same GRN instead of double-registering', async () => {
    purchaseOrderId = await createIssuedPurchaseOrder();
    const grnId = await createReceivedGrn(EACH);

    const first = await createJson('POST', `/api/v1/grn/${grnId}/post`, {});
    expect(first.status).toBe(200);

    // Same command again — the idempotency guard (scope `grn.post`, key falls
    // back to the GRN id) must replay the original result, not post twice.
    const replay = await createJson('POST', `/api/v1/grn/${grnId}/post`, {});
    expect(replay.status).toBe(200);
    expect((replay.body as { data: { id: string } }).data.id).toBe(
      (first.body as { data: { id: string } }).data.id,
    );

    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { lines: true },
    });
    const received = po.lines.reduce((sum, l) => sum + Number(l.receivedQuantity), 0);
    expect(received).toBe(EACH);
  }, 60_000);
});
