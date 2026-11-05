import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class VendorBillPostedListener {
  private readonly logger = new Logger(VendorBillPostedListener.name);
}
