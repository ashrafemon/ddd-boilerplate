import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { InvoiceQueryRecord } from '../../domain/types/invoice.types';

/** QUERY repository port (abstract class = DI token) — read side only. */
export abstract class InvoiceQuery {
  abstract findById(id: string): Promise<InvoiceQueryRecord | null>;
  abstract findAll(query: PageQuery): Promise<PageResult<InvoiceQueryRecord>>;
}
