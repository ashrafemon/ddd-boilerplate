import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { PrismaReadPort } from '@platform/database/ports/prisma-read.port';
import { InvoiceQuery } from '../../application/queries/invoice.query';
import { InvoiceQueryRecord } from '../../domain/types/invoice.types';
import { PrismaInvoiceMapper } from './prisma-invoice.mapper';

@Injectable()
export class PrismaInvoiceQueryRepository extends InvoiceQuery {
  constructor(private readonly prismaRead: PrismaReadPort) {
    super();
  }

  async findById(id: string): Promise<InvoiceQueryRecord | null> {
    const row = await this.prismaRead.invoice.findUnique({ where: { id } });
    return row ? PrismaInvoiceMapper.toRecord(row) : null;
  }

  async findAll(query: PageQuery): Promise<PageResult<InvoiceQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prismaRead.invoice.findMany({
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaRead.invoice.count(),
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
