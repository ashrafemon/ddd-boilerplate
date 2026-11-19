import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { InboxPort } from '@platform/platform-common/inbox/ports/inbox.port';
import { PriceListCommandRepository } from '../../../domain/repositories/price-list-command.repository';

@Injectable()
export class GoodsReceiptPostedListener {
  constructor(
    private readonly inbox: InboxPort,
    private readonly requestContext: RequestContextPort,
    private readonly priceListRepository: PriceListCommandRepository,
  ) {}
}
