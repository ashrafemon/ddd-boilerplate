import { GoodsReceiptPostedListener } from './goods-receipt-posted.listener';
import { InboxPort } from '@platform/platform-common/inbox/ports/inbox.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { PriceListCommandRepository } from '../../../domain/repositories/price-list-command.repository';

describe('GoodsReceiptPostedListener (price list)', () => {
  it('instantiates with its dependencies', () => {
    const listener = new GoodsReceiptPostedListener(
      {} as InboxPort,
      {} as RequestContextPort,
      {} as PriceListCommandRepository,
    );
    expect(listener).toBeInstanceOf(GoodsReceiptPostedListener);
  });
});
