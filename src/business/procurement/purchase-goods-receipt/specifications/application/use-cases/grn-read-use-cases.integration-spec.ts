import { NotFoundException } from '@nestjs/common';
import { GetGrnUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/get-grn.usecase';
import { ListGrnsUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/list-grns.usecase';
import {
  InMemoryGrnQuery,
  makeGrnQueryRecord,
} from '@test/support/purchase-goods-receipt/grn.fakes';

describe('GRN read use cases (integration)', () => {
  it('GetGrnUseCase returns the record', async () => {
    const query = new InMemoryGrnQuery();
    query.byId.set('grn-1', makeGrnQueryRecord());
    const useCase = new GetGrnUseCase(query);

    const result = await useCase.execute('grn-1');
    expect(result.grnNumber).toBe('GRN-00000001');
  });

  it('GetGrnUseCase throws when missing', async () => {
    const useCase = new GetGrnUseCase(new InMemoryGrnQuery());
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('ListGrnsUseCase returns a page', async () => {
    const query = new InMemoryGrnQuery();
    query.byId.set('grn-1', makeGrnQueryRecord());
    query.byId.set('grn-2', makeGrnQueryRecord({ id: 'grn-2' }));

    const useCase = new ListGrnsUseCase(query);
    const result = await useCase.execute({ page: 1, pageSize: 10 });
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('ListGrnsUseCase returns an empty page when there are no GRNs', async () => {
    const useCase = new ListGrnsUseCase(new InMemoryGrnQuery());
    const result = await useCase.execute({ page: 1, pageSize: 20 });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
