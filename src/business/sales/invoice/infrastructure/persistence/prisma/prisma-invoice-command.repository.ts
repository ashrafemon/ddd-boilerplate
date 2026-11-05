import { ConflictException, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Invoice } from '../../domain/aggregates/invoice.aggregate';
import { InvoiceCommandRepository } from '../../domain/repositories/invoice-command.repository';
import { PrismaInvoiceMapper } from './prisma-invoice.mapper';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { resolveCompanyId } from '@shared-kernel/constants/company';

@Injectable()
export class PrismaInvoiceCommandRepository extends InvoiceCommandRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  /** An invoice is an OWNED document — only the request's own rows are visible. */
  private ownedScope(): { tenantId?: string } {
    return TenantScope.where<{ tenantId?: string }>(this.requestContext.getTenantId());
  }

  async findById(id: string): Promise<Invoice | null> {
    const row = await this.txHost.tx.invoice.findFirst({
      where: { id, ...this.ownedScope() },
    });
    return row ? PrismaInvoiceMapper.toDomain(row) : null;
  }

  async save(invoice: Invoice): Promise<Invoice> {
    await this.txHost.tx.invoice.create({
      data: {
        ...PrismaInvoiceMapper.toRow(invoice),
        tenantId: this.requestContext.getTenantId(),
        companyId: resolveCompanyId(this.requestContext.get()),
      } as never,
    });
    return invoice;
  }

  async update(invoice: Invoice): Promise<Invoice> {
    // Scoped write: `updateMany` (not `update`) so the tenant predicate can
    // join the WHERE clause. Zero rows ⇒ the row is gone or belongs to another
    // tenant — the use case already 404s a foreign row on its scoped read.
    const res = await this.txHost.tx.invoice.updateMany({
      where: { id: invoice.id.toString(), ...this.ownedScope() },
      data: { ...PrismaInvoiceMapper.toRow(invoice) } as never,
    });
    if (res.count === 0) {
      throw new ConflictException('Invoice was modified concurrently (not found in scope)');
    }
    return invoice;
  }
}
