import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { PRODUCT_COMMAND_PORT } from './../src/business/product/ports/inbound/product.command.port';
import { VENDOR_QUERY_PORT } from './../src/business/vendor/ports/inbound/vendor.query.port';
import { PURCHASE_ORDER_COMMAND_PORT } from './../src/business/purchase-order/ports/inbound/purchase-order.command.port';
import { OUTBOX_WRITER } from './../src/platform/ports/outbox-writer.port';

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

  it('registers all business inbound ports', () => {
    expect(app.get(PRODUCT_COMMAND_PORT)).toBeDefined();
    expect(app.get(VENDOR_QUERY_PORT)).toBeDefined();
    expect(app.get(PURCHASE_ORDER_COMMAND_PORT)).toBeDefined();
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
