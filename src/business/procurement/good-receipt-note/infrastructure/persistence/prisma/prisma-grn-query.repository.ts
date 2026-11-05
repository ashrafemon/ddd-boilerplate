import { GrnQueryRecord } from '@business/procurement/good-receipt-note/domain/types/grn.types';
import { GrnQuery } from '@business/procurement/good-receipt-note/application/queries/grn.query';
import { PrismaReadPort } from '@platform/context/ports/prisma-read.port';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { Injectable } from '@nestjs/common';
import { PrismaGrnMapper } from './prisma-grn.mapper';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';

@Injectable()
export class PrismaGrnQueryRepository extends GrnQuery {
  constructor(
    private readonly prismaRead: PrismaReadPort,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  /** A GRN is an OWNED document — only the request's own rows are visible. */
  private ownedScope(): { tenantId?: string } {
    return TenantScope.where<{ tenantId?: string }>(this.requestContext.getTenantId());
  }

  async findById(id: string): Promise<GrnQueryRecord | null> {
    const row = await (
      this.prismaRead as never as {
        goodReceiptNote: {
          findFirst: (args: { where: { id: string; tenantId?: string } }) => Promise<unknown>;
        };
      }
    ).goodReceiptNote.findFirst({ where: { id, ...this.ownedScope() } });
    return row ? PrismaGrnMapper.toRecord(row as never) : null;
  }

  async findByGrnNumber(grnNumber: string): Promise<GrnQueryRecord | null> {
    const row = await (
      this.prismaRead as never as {
        goodReceiptNote: {
          findFirst: (args: {
            where: { grnNumber: string; tenantId?: string };
          }) => Promise<unknown>;
        };
      }
    ).goodReceiptNote.findFirst({ where: { grnNumber, ...this.ownedScope() } });
    return row ? PrismaGrnMapper.toRecord(row as never) : null;
  }

  async findAll(query: PageQuery): Promise<PageResult<GrnQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      (
        this.prismaRead as never as {
          goodReceiptNote: {
            findMany: (args: {
              where: { tenantId?: string };
              skip: number;
              take: number;
              orderBy: { createdAt: string };
            }) => Promise<unknown[]>;
          };
        }
      ).goodReceiptNote.findMany({
        where: this.ownedScope(),
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      (
        this.prismaRead as never as {
          goodReceiptNote: { count: (args: { where: { tenantId?: string } }) => Promise<number> };
        }
      ).goodReceiptNote.count({ where: this.ownedScope() }),
    ]);
    return {
      items: (rows as never[]).map((row: never) => PrismaGrnMapper.toRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
