import { Injectable } from '@nestjs/common';
import { InvoiceQuery } from '../queries/invoice.query';
import { InvoiceQueryRecord } from '../../domain/types/invoice.types';

@Injectable()
export class GetInvoiceUseCase {
  constructor(private readonly invoiceQueryRepo: InvoiceQuery) {}

  async execute(id: string): Promise<InvoiceQueryRecord | null> {
    return this.invoiceQueryRepo.findById(id);
  }
}
