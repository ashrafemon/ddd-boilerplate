import { NotFoundException } from '@nestjs/common';
import { GetVendorUseCase } from './get-vendor.usecase';
import { VendorQuery } from '../queries/vendor.query';
import { VendorQueryRecord } from '../../domain/types/vendor.types';

describe('GetVendorUseCase', () => {
  const query = { findById: jest.fn() };
  let usecase: GetVendorUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new GetVendorUseCase(query as unknown as VendorQuery);
  });

  it('returns the vendor projection', async () => {
    const record = { id: 'v-1', name: 'Acme' } as unknown as VendorQueryRecord;
    query.findById.mockResolvedValue(record);
    await expect(usecase.execute('v-1')).resolves.toBe(record);
    expect(query.findById).toHaveBeenCalledWith('v-1');
  });

  it('throws NotFound when the vendor does not exist', async () => {
    query.findById.mockResolvedValue(null);
    await expect(usecase.execute('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
