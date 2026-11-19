import { Injectable } from '@nestjs/common';
import {
  NextNumberOptions,
  NumberingPort as PurchaseOrderNumberingPort,
} from '@business/procurement/purchase-order/application/outbound-ports/numbering.port';
import { NumberingPort } from '@platform/platform-common/numbering/ports/numbering.port';

@Injectable()
export class NumberingAdapter implements PurchaseOrderNumberingPort {
  constructor(private readonly platformNumbering: NumberingPort) {}

  nextNumber(sequenceKey: string, options?: NextNumberOptions): Promise<string> {
    return this.platformNumbering.nextNumber(sequenceKey, options);
  }
}
