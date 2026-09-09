import { Injectable } from '@nestjs/common';
import { PrismaReadService } from '@infrastructure/database/prisma/prisma-read.service';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { VendorQuery } from '@business/party/vendor/application/queries/vendor.query';
import { VendorQueryRecord } from '../../domain/types/vendor.types';
import { VendorStatus } from '../../domain/types/vendor.enum';
import { PrismaVendorQueryMapper } from './prisma-vendor.mapper';

@Injectable()
export class PrismaVendorQueryRepository extends VendorQuery {
  constructor(private readonly prismaRead: PrismaReadService) {
    super();
  }

  async findById(id: string): Promise<VendorQueryRecord | null> {
    const row = await this.prismaRead.vendor.findUnique({ where: { id } });
    return row ? PrismaVendorQueryMapper.toRecord(row as never) : null;
  }

  async findOrderableById(id: string): Promise<VendorQueryRecord | null> {
    const row = await this.prismaRead.vendor.findFirst({
      where: { id, status: 'ACTIVE' as never },
    });
    return row ? PrismaVendorQueryMapper.toRecord(row as never) : null;
  }

  async findAll(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prismaRead.vendor.findMany({
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaRead.vendor.count(),
    ]);
    return {
      items: rows.map((row: never) => PrismaVendorQueryMapper.toRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
