import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { PrismaReadPort } from '@platform/context/ports/prisma-read.port';
import { InvoiceQuery } from '../../application/queries/invoice.query';
import { InvoiceQueryRecord } from '../../domain/types/invoice.types';
import { PrismaInvoiceMapper } from './prisma-invoice.mapper';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';

@Injectable()
export class PrismaInvoiceQueryRepository extends InvoiceQuery {
  constructor(
    private readonly prismaRead: PrismaReadPort,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  /** An invoice is an OWNED document — only the request's own rows are visible. */
  private ownedScope(): { tenantId?: string } {
    return TenantScope.where<{ tenantId?: string }>(this.requestContext.getTenantId());
  }

  async findById(id: string): Promise<InvoiceQueryRecord | null> {
    const row = await this.prismaRead.invoice.findFirst({
      where: { id, ...this.ownedScope() },
    });
    return row ? PrismaInvoiceMapper.toRecord(row) : null;
  }

  async findAll(query: PageQuery): Promise<PageResult<InvoiceQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prismaRead.invoice.findMany({
        where: this.ownedScope(),
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaRead.invoice.count({ where: this.ownedScope() }),
    ]);
    return {
      items: rows.map((row: never) => PrismaInvoiceMapper.toRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
