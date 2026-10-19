import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaWriteService } from '../src/infrastructure/database/prisma/prisma-write.service';
import { createTestApp } from './utils/create-test-app';

/**
 * Platform smoke test — the services that only run in the BACKGROUND.
 *
 * Now that the outbox publishes, the platform's own services finally get
 * exercised: the notification pipeline, the batch-operation engine and the
 * scheduler. Each one is proven to do its job end to end through the real
 * HTTP surface and the real database.
 *
 * Requires `docker compose up -d` + `.env`.
 */
describe('platform services (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaWriteService;

  const tenant = 'platform-tenant';
  const company = '00000000-0000-4000-8000-00000000c0de';

  const stamp = Date.now();
  const sku = `PLT-SKU-${stamp}`;
  const vendorCode = `PLT-V-${stamp}`;

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
        'x-user-id': 'platform-user',
        'idempotency-key': `plt-${stamp}-${++idempotencySeq}`,
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

  /** Wait for a condition — the background services tick on their own schedule. */
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

  beforeAll(async () => {
    ({ app } = await createTestApp());
    prisma = app.get(PrismaWriteService);
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    if (purchaseOrderId) {
      await prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId } });
      await prisma.purchaseOrder.deleteMany({ where: { id: purchaseOrderId } });
      await prisma.outboxMessage.deleteMany({ where: { aggregateId: purchaseOrderId } });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (vendorId) await prisma.vendor.deleteMany({ where: { id: vendorId } });
  });

  async function seedMasterData(): Promise<void> {
    const vendor = await prisma.vendor.create({
      data: {
        code: vendorCode,
        name: 'Platform Vendor',
        email: `plt-${stamp}@example.com`,
        tenantId: tenant,
        companyId: company,
      },
      select: { id: true },
    });
    vendorId = vendor.id;

    const product = await prisma.product.create({
      data: {
        sku,
        name: 'Platform Product',
        unitPrice: 10,
        currency: 'USD',
        tenantId: tenant,
        companyId: company,
      },
      select: { id: true },
    });
    productId = product.id;
  }

  async function createPo(): Promise<string> {
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
    return id;
  }

  it('turns a domain event into a notification request', async () => {
    await seedMasterData();
    purchaseOrderId = await createPo();

    // Approving publishes `PurchaseOrderApproved`, and the platform's
    // notification dispatcher turns it into a notification request.
    const submitted = await call('PATCH', `/api/v1/purchase-orders/${purchaseOrderId}/submit`, {});
    expectStatus(submitted, 200, 'submit purchase order');
    const approved = await call('PATCH', `/api/v1/purchase-orders/${purchaseOrderId}/approve`, {});
    expectStatus(approved, 200, 'approve purchase order');

    await waitFor(
      async () => (await prisma.notificationRequest.count({ where: { tenantId: tenant } })) > 0,
      'the notification pipeline to create a request',
    );

    const request = await prisma.notificationRequest.findFirstOrThrow({
      where: { tenantId: tenant },
      select: { notificationType: true, status: true, totalMessages: true },
    });
    expect(request.notificationType).toBe('PurchaseOrderApproved');
    expect(request.totalMessages).toBeGreaterThan(0);
  }, 90_000);

  it('runs a batch operation over several purchase orders', async () => {
    await seedMasterData();

    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      ids.push(await createPo());
    }
    purchaseOrderId = ids[0];

    const submitted = await call('POST', '/api/v1/batch-operations', {
      aggregateType: 'PurchaseOrder',
      operationCode: 'submit',
      entityIds: ids,
    });
    expectStatus(submitted, 201, 'submit batch operation');

    const jobId = (submitted.body as { data: { id: string } }).data.id;

    await waitFor(async () => {
      const job = await prisma.batchOperationJob.findUnique({
        where: { id: jobId },
        select: { status: true, successRecords: true, totalRecords: true },
      });
      return job?.status === 'COMPLETED' || job?.status === 'FAILED';
    }, 'the batch operation to finish');

    const job = await prisma.batchOperationJob.findUniqueOrThrow({
      where: { id: jobId },
      select: { status: true, successRecords: true, totalRecords: true },
    });
    expect(job.status).toBe('COMPLETED');
    expect(job.successRecords).toBe(ids.length);

    // The batch really moved the orders on.
    const orders = await prisma.purchaseOrder.findMany({
      where: { id: { in: ids } },
      select: { status: true },
    });
    expect(orders.every(o => o.status === 'SUBMITTED')).toBe(true);

    // Clean up the batch rows.
    await prisma.batchOperationJobRow.deleteMany({ where: { batchOperationJobId: jobId } });
    await prisma.batchOperationJob.deleteMany({ where: { id: jobId } });
    for (const id of ids) {
      await prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
      await prisma.purchaseOrder.deleteMany({ where: { id } });
      await prisma.outboxMessage.deleteMany({ where: { aggregateId: id } });
    }
  }, 90_000);
});
