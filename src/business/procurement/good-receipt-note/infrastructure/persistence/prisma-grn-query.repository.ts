import { GrnQueryRecord } from '@business/procurement/good-receipt-note/domain/types/grn.types';
import { GrnQuery } from '@business/procurement/good-receipt-note/application/queries/grn.query';
import { PrismaReadService } from '@infrastructure/database/prisma/prisma-read.service';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { Injectable } from '@nestjs/common';
import { PrismaGrnMapper } from './prisma-grn.mapper';

@Injectable()
export class PrismaGrnQueryRepository extends GrnQuery {
  constructor(private readonly prismaRead: PrismaReadService) {
    super();
  }

  async findById(id: string): Promise<GrnQueryRecord | null> {
    const row = await (
      this.prismaRead as never as {
        goodReceiptNote: { findUnique: (args: { where: { id: string } }) => Promise<unknown> };
      }
    ).goodReceiptNote.findUnique({ where: { id } });
    return row ? PrismaGrnMapper.toRecord(row as never) : null;
  }

  async findByGrnNumber(grnNumber: string): Promise<GrnQueryRecord | null> {
    const row = await (
      this.prismaRead as never as {
        goodReceiptNote: {
          findUnique: (args: { where: { grnNumber: string } }) => Promise<unknown>;
        };
      }
    ).goodReceiptNote.findUnique({ where: { grnNumber } });
    return row ? PrismaGrnMapper.toRecord(row as never) : null;
  }

  async findAll(query: PageQuery): Promise<PageResult<GrnQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      (
        this.prismaRead as never as {
          goodReceiptNote: {
            findMany: (args: {
              skip: number;
              take: number;
              orderBy: { createdAt: string };
            }) => Promise<unknown[]>;
          };
        }
      ).goodReceiptNote.findMany({
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      (
        this.prismaRead as never as { goodReceiptNote: { count: () => Promise<number> } }
      ).goodReceiptNote.count(),
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
