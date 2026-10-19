import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { PrismaWriteService } from '../src/infrastructure/database/prisma/prisma-write.service';
import { configureHttp } from '../src/bootstrap/configure-http';

/**
 * Cross-tenant isolation (ARCHITECTURE.md §5, AGENTS.md rule 1).
 *
 * The business tables carry `tenantId`, every business read and write is
 * scoped by it, and a resource owned by another tenant must be NOT FOUND —
 * never a 403, so there is no existence leak.
 *
 * This drives the real HTTP surface against the real database, with two
 * different `x-tenant-id` headers. Requires `docker compose up -d` + `.env`.
 */
describe('tenant isolation (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaWriteService;

  const tenantA = 'tenant-a-isolation';
  const tenantB = 'tenant-b-isolation';
  const company = '00000000-0000-4000-8000-00000000a11c';

  const stamp = Date.now();
  const sku = `ISO-SKU-${stamp}`;
  const vendorCode = `ISO-V-${stamp}`;

  const headersFor = (tenant: string) => ({
    'x-tenant-id': tenant,
    'x-company-id': company,
    'x-user-id': `${tenant}-user`,
  });

  let idempotencySeq = 0;
  let productId: string;
  let sharedProductId: string;
  let vendorId: string;
  let purchaseOrderId: string;

  const call = async (
    method: 'POST' | 'PATCH' | 'GET' | 'DELETE',
    url: string,
    tenant: string,
    payload?: unknown,
  ) => {
    const res = await app.inject({
      method,
      url,
      headers: {
        ...headersFor(tenant),
        'idempotency-key': `iso-${stamp}-${++idempotencySeq}`,
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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureHttp(app);
    await app.init();
    prisma = app.get(PrismaWriteService);
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    if (purchaseOrderId) {
      await prisma.purchaseOrder.deleteMany({ where: { id: purchaseOrderId } });
      await prisma.outboxMessage.deleteMany({ where: { aggregateId: purchaseOrderId } });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (sharedProductId) await prisma.product.deleteMany({ where: { id: sharedProductId } });
    if (vendorId) await prisma.vendor.deleteMany({ where: { id: vendorId } });
  });

  /**
   * Master data for the test:
   *  - a vendor owned by tenant A (tenant A can order from it)
   *  - a product owned by tenant A (tenant B must NOT see it)
   *  - a SHARED product (no tenant) — visible to everyone, so a test that
   *    targets the purchase-order tenancy is not short-circuited by the
   *    product lookup failing first.
   */
  async function seedTenantAMasterData(): Promise<void> {
    const vendor = await prisma.vendor.create({
      data: {
        code: vendorCode,
        name: 'Isolation Vendor',
        email: `iso-${stamp}@example.com`,
        tenantId: tenantA,
        companyId: company,
      },
      select: { id: true },
    });
    vendorId = vendor.id;

    const product = await prisma.product.create({
      data: {
        sku,
        name: 'Isolation Product',
        unitPrice: 10,
        currency: 'USD',
        tenantId: tenantA,
        companyId: company,
      },
      select: { id: true },
    });
    productId = product.id;

    const shared = await prisma.product.create({
      data: {
        sku: `${sku}-SHARED`,
        name: 'Shared Product',
        unitPrice: 10,
        currency: 'USD',
      },
      select: { id: true },
    });
    sharedProductId = shared.id;
  }

  it("hides another tenant's purchase order (404, not 403)", async () => {
    await seedTenantAMasterData();

    // Tenant A creates a purchase order.
    const created = await call('POST', '/api/v1/purchase-orders', tenantA, {
      vendorId,
      currency: 'USD',
    });
    expect(created.status).toBe(201);
    purchaseOrderId = (created.body as { data: { id: string } }).data.id;

    // The row must be stamped with the creating tenant.
    const stamped = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      select: { tenantId: true, companyId: true },
    });
    expect(stamped).toEqual({ tenantId: tenantA, companyId: company });

    const added = await call('POST', `/api/v1/purchase-orders/${purchaseOrderId}/lines`, tenantA, {
      productId,
      quantity: 5,
      unitPrice: 10,
      currency: 'USD',
    });
    expect(added.status).toBe(201);

    // Tenant A can read it.
    const own = await call('GET', `/api/v1/purchase-orders/${purchaseOrderId}`, tenantA);
    expect(own.status).toBe(200);

    // The DB filter itself must exclude tenant B's row.
    const scoped = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId: tenantB },
      select: { id: true },
    });
    expect(scoped).toBeNull();

    // Tenant B cannot — NOT FOUND, so there is no existence leak.
    const foreign = await call('GET', `/api/v1/purchase-orders/${purchaseOrderId}`, tenantB);
    expect(foreign.status).toBe(404);
    expect((foreign.body as { statusCode: number }).statusCode).toBe(404);

    // …and it does not appear in tenant B's list.
    const list = await call('GET', '/api/v1/purchase-orders', tenantB);
    expect(list.status).toBe(200);
    const ids = ((list.body as { data: { items?: Array<{ id: string }> } }).data.items ?? []).map(
      i => i.id,
    );
    expect(ids).not.toContain(purchaseOrderId);
  }, 60_000);

  it("refuses to mutate another tenant's purchase order", async () => {
    await seedTenantAMasterData();

    const created = await call('POST', '/api/v1/purchase-orders', tenantA, {
      vendorId,
      currency: 'USD',
    });
    purchaseOrderId = (created.body as { data: { id: string } }).data.id;

    // Tenant B tries to submit it. The aggregate cannot even be loaded, so
    // the transition use case reports NOT FOUND.
    const submitted = await call(
      'PATCH',
      `/api/v1/purchase-orders/${purchaseOrderId}/submit`,
      tenantB,
      {},
    );
    expect(submitted.status).toBe(404);

    // Tenant B tries to add a line to it — the shared product is visible to
    // tenant B, so the purchase-order scope is what refuses the write.
    const line = await call('POST', `/api/v1/purchase-orders/${purchaseOrderId}/lines`, tenantB, {
      productId: sharedProductId,
      quantity: 1,
      unitPrice: 10,
      currency: 'USD',
    });
    expect(line.status).toBe(404);

    // The order is untouched.
    const row = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      select: { status: true, lines: { select: { id: true } } },
    });
    expect(row.status).toBe('DRAFT');
    expect(row.lines).toHaveLength(0);
  }, 60_000);

  it("keeps a tenant-owned master-data row out of another tenant's reach", async () => {
    await seedTenantAMasterData();

    // Tenant A's product is invisible to tenant B.
    const foreign = await call('GET', `/api/v1/products/${productId}`, tenantB);
    expect(foreign.status).toBe(404);

    // Tenant A sees it.
    const own = await call('GET', `/api/v1/products/${productId}`, tenantA);
    expect(own.status).toBe(200);
  }, 60_000);
});
