import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { InvoiceQuery } from '../queries/invoice.query';
import { InvoiceQueryRecord } from '../../domain/types/invoice.types';

@Injectable()
export class ListInvoicesUseCase {
  constructor(private readonly invoiceQueryRepo: InvoiceQuery) {}

  async execute(query: PageQuery): Promise<PageResult<InvoiceQueryRecord>> {
    return this.invoiceQueryRepo.findAll(query);
  }
}
