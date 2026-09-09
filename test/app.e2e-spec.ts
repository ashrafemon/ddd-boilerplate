import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { CreateProductUseCase } from './../src/business/catalog/product/application/usecases/create-product.usecase';
import { GetPurchasableProductUseCase } from './../src/business/catalog/product/application/usecases/get-purchasable-product.usecase';
import { GetOrderableVendorUseCase } from './../src/business/party/vendor/application/usecases/get-orderable-vendor.usecase';
import { CreatePurchaseOrderUseCase } from './../src/business/procurement/purchase-order/application/usecases/create-purchase-order.usecase';
import { OutboxWriterPort } from './../src/platform/outbox/ports/outbox-writer.port';

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
    expect(app.get(OutboxWriterPort)).toBeDefined();
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
