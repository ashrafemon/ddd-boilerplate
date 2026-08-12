import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { CreateProductUseCase } from './../src/business/catalog/product/application/usecase/create-product.usecase';
import { GetPurchasableProductUseCase } from './../src/business/catalog/product/application/usecase/get-purchasable-product.usecase';
import { GetOrderableVendorUseCase } from './../src/business/supplier/vendor/application/usecase/get-orderable-vendor.usecase';
import { CreatePurchaseOrderUseCase } from './../src/business/procurement/purchase/application/usecase/create-purchase-order.usecase';
import { OUTBOX_WRITER } from './../src/platform/outbox/ports/outbox-writer.port';

/**
 * E2E smoke test — verifies the application boots with all business modules
 * wired. Requires Postgres + Redis + RabbitMQ running (`docker compose up -d`)
 * and DATABASE_URL set in .env.
 */
describe('App (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
  }, 30_000);

  it('registers all business use cases and shared ports', () => {
    expect(app.get(CreateProductUseCase)).toBeDefined();
    expect(app.get(GetPurchasableProductUseCase)).toBeDefined();
    expect(app.get(GetOrderableVendorUseCase)).toBeDefined();
    expect(app.get(CreatePurchaseOrderUseCase)).toBeDefined();
    expect(app.get(OUTBOX_WRITER)).toBeDefined();
  });

  it('returns a JSON error envelope for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });
    expect(res.statusCode).toBe(404);
    const body: Record<string, unknown> = JSON.parse(res.body) as Record<string, unknown>;
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('message');
  });

  afterAll(async () => {
    await app.close();
  });
});
