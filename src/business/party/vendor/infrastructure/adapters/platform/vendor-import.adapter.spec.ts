import { VendorImportHandler } from './vendor-import.adapter';
import { CreateVendorUseCase } from '../../../application/use-cases/create-vendor.usecase';

describe('VendorImportHandler', () => {
  const createVendor = { execute: jest.fn() };
  let handler: VendorImportHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new VendorImportHandler(createVendor as unknown as CreateVendorUseCase);
  });

  it('preloads no references', async () => {
    await expect(handler.preloadReferences()).resolves.toEqual({});
  });

  it('validates required fields and email format', async () => {
    const verdicts = await handler.validateBatch([
      { rowNumber: 1, code: 'V1', name: 'Acme' },
      { rowNumber: 2, name: 'Missing code' },
      { rowNumber: 3, code: 'V3', name: 'Bad email', email: 'nope' },
    ]);
    expect(verdicts[0]).toMatchObject({ status: 'VALID' });
    expect(verdicts[1]).toMatchObject({ status: 'INVALID', errors: ['code is required'] });
    expect(verdicts[2].errors).toContain('email is invalid');
  });

  it('applies rows through the create use case', async () => {
    createVendor.execute.mockResolvedValue({ toString: () => 'v-1' });
    const results = await handler.executeBatch([{ rowNumber: 1, code: ' V1 ', name: ' Acme ' }]);
    expect(createVendor.execute).toHaveBeenCalledWith({
      code: 'V1',
      name: 'Acme',
      email: undefined,
      phone: undefined,
      address: undefined,
    });
    expect(results).toEqual([{ rowNumber: 1, status: 'APPLIED', entityId: 'v-1' }]);
  });

  it('reports row failures without aborting the batch', async () => {
    createVendor.execute.mockRejectedValue(new Error('duplicate code'));
    const results = await handler.executeBatch([{ rowNumber: 1, code: 'V1', name: 'Acme' }]);
    expect(results[0]).toMatchObject({ status: 'FAILED', errorMessage: 'duplicate code' });
  });
});
