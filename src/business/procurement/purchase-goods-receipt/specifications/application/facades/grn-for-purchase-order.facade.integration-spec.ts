import { NotFoundException } from '@nestjs/common';
import { GrnForPurchaseOrderFacade } from '@business/procurement/purchase-goods-receipt/application/facades/grn-for-purchase-order.facade';
import { GetGrnUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/get-grn.usecase';
import {
  InMemoryGrnQuery,
  makeGrnQueryRecord,
} from '@test/support/purchase-goods-receipt/grn.fakes';

describe('GrnForPurchaseOrderFacade (integration)', () => {
  it('delegates getGrn to the use case', async () => {
    const query = new InMemoryGrnQuery();
    query.byId.set('grn-1', makeGrnQueryRecord());
    const facade = new GrnForPurchaseOrderFacade(new GetGrnUseCase(query));

    await expect(facade.getGrn('grn-1')).resolves.toMatchObject({ grnNumber: 'GRN-00000001' });
    await expect(facade.getGrn('missing')).rejects.toThrow(NotFoundException);
  });
});
