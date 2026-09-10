import { Invoice } from '../aggregates/invoice.aggregate';

/**
 * Command-side repository port. The adapter injects the transactional host so
 * all writes participate in the use case's @Transactional boundary. Returns /
 * accepts domain aggregates only — never Prisma rows.
 */
export abstract class InvoiceCommandRepository {
  abstract findById(id: string): Promise<Invoice | null>;
  abstract save(invoice: Invoice): Promise<Invoice>;
  abstract update(invoice: Invoice): Promise<Invoice>;
}
