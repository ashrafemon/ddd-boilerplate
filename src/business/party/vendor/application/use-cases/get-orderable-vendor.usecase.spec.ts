import { GetOrderableVendorUseCase } from './get-orderable-vendor.usecase';
import { VendorQuery } from '../queries/vendor.query';
import { VendorQueryRecord } from '../../domain/types/vendor.types';

describe('GetOrderableVendorUseCase', () => {
  const query = { findOrderableById: jest.fn() };
  let usecase: GetOrderableVendorUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new GetOrderableVendorUseCase(query as unknown as VendorQuery);
  });

  it('returns an orderable vendor', async () => {
    const result = { id: 'v-1' } as unknown as VendorQueryRecord;
    query.findOrderableById.mockResolvedValue(result);
    await expect(usecase.execute('v-1')).resolves.toBe(result);
    expect(query.findOrderableById).toHaveBeenCalledWith('v-1');
  });

  it('returns null when the vendor is not orderable', async () => {
    query.findOrderableById.mockResolvedValue(null);
    await expect(usecase.execute('v-1')).resolves.toBeNull();
  });
});
