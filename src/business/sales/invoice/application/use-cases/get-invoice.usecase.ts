import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceQuery } from '../queries/invoice.query';
import { InvoiceQueryRecord } from '../../domain/types/invoice.types';

@Injectable()
export class GetInvoiceUseCase {
  constructor(private readonly invoiceQueryRepo: InvoiceQuery) {}

  async execute(id: string): Promise<InvoiceQueryRecord> {
    const record = await this.invoiceQueryRepo.findById(id);
    if (!record) {
      throw new NotFoundException('Invoice not found');
    }
    return record;
  }
}
