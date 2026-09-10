import { Injectable } from '@nestjs/common';
import {
  NextNumberOptions,
  NumberingPort as InvoiceNumberingPort,
} from '@business/sales/invoice/application/outbound-ports/numbering.port';
import { NumberingPort } from '@platform/numbering/ports/numbering.port';

@Injectable()
export class NumberingAdapter implements InvoiceNumberingPort {
  constructor(private readonly platformNumbering: NumberingPort) {}

  nextNumber(sequenceKey: string, options?: NextNumberOptions): Promise<string> {
    return this.platformNumbering.nextNumber(sequenceKey, options);
  }
}
