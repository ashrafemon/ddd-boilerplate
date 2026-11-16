import { NotFoundException } from '@nestjs/common';
import { GetGrnUseCase } from './get-grn.usecase';
import { GrnQuery } from '../queries/grn.query';
import { GrnQueryRecord } from '../../domain/types/grn.types';

describe('GetGrnUseCase', () => {
  const query = { findById: jest.fn() };
  let usecase: GetGrnUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new GetGrnUseCase(query as unknown as GrnQuery);
  });

  it('returns the GRN projection', async () => {
    const record = { id: 'grn-1' } as unknown as GrnQueryRecord;
    query.findById.mockResolvedValue(record);
    await expect(usecase.execute('grn-1')).resolves.toBe(record);
    expect(query.findById).toHaveBeenCalledWith('grn-1');
  });

  it('throws NotFound when the GRN does not exist', async () => {
    query.findById.mockResolvedValue(null);
    await expect(usecase.execute('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
