import { Injectable } from '@nestjs/common';
import {
  NextNumberOptions,
  NumberingPort as GrnNumberingPort,
} from '@business/procurement/purchase-goods-receipt/application/outbound-ports/numbering.port';
import { NumberingPort } from '@platform/platform-common/numbering/ports/numbering.port';

@Injectable()
export class NumberingAdapter implements GrnNumberingPort {
  constructor(private readonly platformNumbering: NumberingPort) {}

  nextNumber(sequenceKey: string, options?: NextNumberOptions): Promise<string> {
    return this.platformNumbering.nextNumber(sequenceKey, options);
  }
}
