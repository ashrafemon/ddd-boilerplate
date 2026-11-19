import { CreateRecurringFromPurchaseOrderUseCase } from '../../application/use-cases/create-recurring-from-purchase-order.usecase';
import { CreateRecurringPurchaseOrderUseCase } from '../../application/use-cases/create-recurring-purchase-order.usecase';
import { PurchaseOrderController } from '../../presentation/http/purchase-order.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

const template = {
  id: 'tpl-1',
  name: 'Monthly restock',
  triggerType: 'TIME',
  frequency: 'MONTHLY',
  interval: 1,
  startDate: '2025-02-01',
};

// A TIME trigger needs frequency + interval + startDate (`requireScheduleFields`).
const schedule = {
  triggerType: 'TIME',
  frequency: 'MONTHLY',
  interval: 1,
  startDate: '2025-02-01',
};

describe('POST /purchase-orders/recurring', () => {
  let api: ApiTestApp;
  const createRecurring = { execute: jest.fn() };
  const createRecurringFrom = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PurchaseOrderController,
      providers: [
        { provide: CreateRecurringPurchaseOrderUseCase, useValue: createRecurring },
        { provide: CreateRecurringFromPurchaseOrderUseCase, useValue: createRecurringFrom },
      ],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('creates a template from new data', async () => {
    createRecurring.execute.mockResolvedValue(template);

    const res = await api
      .http()
      .post('/purchase-orders/recurring')
      .send({
        ...schedule,
        name: 'Monthly restock',
        vendorId: '11111111-1111-4111-8111-111111111111',
        lines: [
          {
            productId: '33333333-3333-4333-8333-333333333333',
            quantity: 5,
            unitPrice: 10,
          },
        ],
      })
      .expect(201);

    expect(res.body).toEqual({
      data: template,
      message: 'Recurring purchase order template created',
    });
  });

  it('creates a template from an existing order', async () => {
    createRecurringFrom.execute.mockResolvedValue(template);

    const res = await api
      .http()
      .post('/purchase-orders/po-1/recurring')
      .send({ ...schedule, name: 'Monthly restock' })
      .expect(201);

    expect(createRecurringFrom.execute).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseOrderId: 'po-1' }),
    );
    expect(res.body).toEqual({
      data: template,
      message: 'Recurring purchase order template created',
    });
  });

  it('rejects a schedule without a trigger type (400)', async () => {
    await api
      .http()
      .post('/purchase-orders/recurring')
      .send({ name: 'Monthly restock', vendorId: '11111111-1111-4111-8111-111111111111' })
      .expect(400);
    expect(createRecurring.execute).not.toHaveBeenCalled();
  });

  it('rejects a TIME trigger without a frequency (400)', async () => {
    await api
      .http()
      .post('/purchase-orders/recurring')
      .send({
        triggerType: 'TIME',
        name: 'Monthly restock',
        vendorId: '11111111-1111-4111-8111-111111111111',
      })
      .expect(400);
    expect(createRecurring.execute).not.toHaveBeenCalled();
  });

  it('accepts an EVENT trigger with an event name and no schedule', async () => {
    createRecurring.execute.mockResolvedValue(template);

    await api
      .http()
      .post('/purchase-orders/recurring')
      .send({
        triggerType: 'EVENT',
        eventName: 'grn.posted',
        name: 'Restock after receipt',
        vendorId: '11111111-1111-4111-8111-111111111111',
        lines: [
          {
            productId: '33333333-3333-4333-8333-333333333333',
            quantity: 5,
            unitPrice: 10,
          },
        ],
      })
      .expect(201);
  });
});
