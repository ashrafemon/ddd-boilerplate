import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { CreateProductUseCase } from './../src/business/catalog/product/application/usecases/create-product.usecase';
import { GetPurchasableProductUseCase } from './../src/business/catalog/product/application/usecases/get-purchasable-product.usecase';
import { GetOrderableVendorUseCase } from './../src/business/party/vendor/application/usecases/get-orderable-vendor.usecase';
import { CreatePurchaseOrderUseCase } from './../src/business/procurement/purchase-order/application/usecases/create-purchase-order.usecase';
import { OutboxWriterPort } from './../src/platform/outbox/ports/outbox-writer.port';
import { SchedulerPort } from '../src/platform/scheduler/ports/scheduler.port';
import { ScheduledJobHandlerRegistry } from '../src/platform/scheduler/scheduled-job-handler.registry';
import { RecurringExecutionPort } from '../src/platform/recurring/ports/recurring-execution.port';
import { RecurringGeneratorRegistry } from '../src/platform/recurring/recurring-generator.registry';
import { ConditionEvaluator } from './../src/platform/condition-engine/ports/condition-evaluator.port';
import { BatchOperationHandlerRegistry } from '../src/platform/batch-operation/batch-operation-handler.registry';
import { ImportHandlerRegistry } from '../src/platform/import/import-handler.registry';
import { GenerateRecurringInvoiceUseCase } from './../src/business/sales/invoice/application/usecases/generate-recurring-invoice.usecase';

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

  it('registers the ported platform services and their opt-in registries', () => {
    expect(app.get(SchedulerPort)).toBeDefined();
    expect(app.get(RecurringExecutionPort)).toBeDefined();
    expect(app.get(ConditionEvaluator)).toBeDefined();
    expect(app.get(GenerateRecurringInvoiceUseCase)).toBeDefined();

    // opt-in registrations applied by the owning modules at bootstrap
    expect(app.get(ScheduledJobHandlerRegistry).has('Recurring')).toBe(true);
    expect(app.get(RecurringGeneratorRegistry)).toBeDefined();
    expect(app.get(BatchOperationHandlerRegistry).health()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ aggregateType: 'PurchaseOrder' }),
        expect.objectContaining({ aggregateType: 'GoodReceiptNote' }),
      ]),
    );
    expect(app.get(ImportHandlerRegistry).health()).toEqual(
      expect.arrayContaining([expect.objectContaining({ entityKey: 'vendor' })]),
    );
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
