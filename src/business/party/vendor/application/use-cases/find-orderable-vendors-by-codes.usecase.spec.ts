import { FindOrderableVendorsByCodesUseCase } from './find-orderable-vendors-by-codes.usecase';
import { VendorQuery } from '../queries/vendor.query';
import { VendorQueryRecord } from '../../domain/types/vendor.types';

describe('FindOrderableVendorsByCodesUseCase', () => {
  const query = { findOrderableByCodes: jest.fn() };
  let usecase: FindOrderableVendorsByCodesUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new FindOrderableVendorsByCodesUseCase(query as unknown as VendorQuery);
  });

  it('returns orderable vendors by code', async () => {
    const result = [{ id: 'v-1' }] as unknown as VendorQueryRecord[];
    query.findOrderableByCodes.mockResolvedValue(result);
    await expect(usecase.execute(['VEN-1'])).resolves.toBe(result);
    expect(query.findOrderableByCodes).toHaveBeenCalledWith(['VEN-1']);
  });
});
