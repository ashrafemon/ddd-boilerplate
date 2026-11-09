import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { InboxPort } from '@platform/platform-common/inbox/ports/inbox.port';

@Injectable()
export class VendorBillPostedListener {
  constructor(
    private readonly inbox: InboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}
}
