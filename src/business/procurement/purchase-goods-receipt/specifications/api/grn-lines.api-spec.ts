import { AddGrnLineUseCase } from '../../application/use-cases/add-grn-line.usecase';
import { SetGrnLineTrackingUseCase } from '../../application/use-cases/set-grn-line-tracking.usecase';
import { GrnController } from '../../presentation/http/grn.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

const productId = '33333333-3333-4333-8333-333333333333';

describe('PATCH /grn/:id/lines and /lines/:productId/tracking', () => {
  let api: ApiTestApp;
  const addLine = { execute: jest.fn() };
  const setTracking = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: GrnController,
      providers: [
        { provide: AddGrnLineUseCase, useValue: addLine },
        { provide: SetGrnLineTrackingUseCase, useValue: setTracking },
      ],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('adds a line', async () => {
    addLine.execute.mockResolvedValue(idOf('grn-1'));

    const res = await api
      .http()
      .patch('/grn/grn-1/lines')
      .send({ productId, orderedQuantity: 2, receivedQuantity: 2, unitPrice: 10 })
      .expect(201);

    expect(addLine.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'grn-1', productId }),
    );
    expect(res.body).toEqual({ data: { id: 'grn-1' }, message: 'Line added' });
  });

  it('rejects a line without receivedQuantity (400)', async () => {
    await api
      .http()
      .patch('/grn/grn-1/lines')
      .send({ productId, orderedQuantity: 2, unitPrice: 10 })
      .expect(400);
    expect(addLine.execute).not.toHaveBeenCalled();
  });

  it('records lot/serial tracking for a line', async () => {
    setTracking.execute.mockResolvedValue(idOf('grn-1'));

    const res = await api
      .http()
      .patch(`/grn/grn-1/lines/${productId}/tracking`)
      .send({
        productId,
        entries: [{ lotNo: 'LOT-1', quantity: 2, expiryDate: '2026-01-01T00:00:00.000Z' }],
      })
      .expect(200);

    expect(setTracking.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'grn-1', productId }),
    );
    expect(res.body).toEqual({ data: { id: 'grn-1' }, message: 'Tracking set' });
  });

  it('rejects a tracking entry without a positive quantity (400)', async () => {
    await api
      .http()
      .patch(`/grn/grn-1/lines/${productId}/tracking`)
      .send({ productId, entries: [{ lotNo: 'LOT-1', quantity: 0 }] })
      .expect(400);
    expect(setTracking.execute).not.toHaveBeenCalled();
  });
});
