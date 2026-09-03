import { Injectable } from '@nestjs/common';
import { PrismaReadService } from '@infrastructure/database/prisma/prisma-read.service';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { VendorQueryRepositoryPort } from '@business/party/vendor/domain/domain-ports';
import { VendorQueryRecord } from '../../domain/types/vendor.types';
import { VendorStatus } from '../../domain/types/vendor.enum';

@Injectable()
export class PrismaVendorQueryRepository extends VendorQueryRepositoryPort {
  constructor(private readonly prismaRead: PrismaReadService) {
    super();
  }

  async findById(id: string): Promise<VendorQueryRecord | null> {
    const row = await this.prismaRead.vendor.findUnique({ where: { id } });
    return row ? this.toRecord(row as never) : null;
  }

  async findOrderableById(id: string): Promise<VendorQueryRecord | null> {
    const row = await this.prismaRead.vendor.findFirst({
      where: { id, status: 'ACTIVE' as never },
    });
    return row ? this.toRecord(row as never) : null;
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
      items: rows.map((row: never) => this.toRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  private toRecord(row: never): VendorQueryRecord {
    const r = row as {
      id: string;
      code: string;
      name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      email: r.email,
      phone: r.phone,
      address: r.address,
      status: r.status as VendorStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
