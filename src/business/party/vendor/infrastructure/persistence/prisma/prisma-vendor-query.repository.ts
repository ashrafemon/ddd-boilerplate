import { Injectable } from '@nestjs/common';
import { PrismaReadPort } from '@platform/context/ports/prisma-read.port';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { VendorQuery } from '@business/party/vendor/application/queries/vendor.query';
import { VendorQueryRecord } from '../../domain/types/vendor.types';
import { PrismaVendorMapper } from './prisma-vendor.mapper';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';

@Injectable()
export class PrismaVendorQueryRepository extends VendorQuery {
  constructor(
    private readonly prismaRead: PrismaReadPort,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  /**
   * Master data is SHARED: the request's own rows plus rows that were never
   * tenant-scoped (NULL = the shared catalogue). A row owned by another
   * tenant is invisible.
   */
  private sharedScope(): { OR: Array<{ tenantId: string | null }> } {
    return TenantScope.where<{ OR: Array<{ tenantId: string | null }> }>(
      this.requestContext.getTenantId(),
      { includeUnscoped: true },
    );
  }

  async findById(id: string): Promise<VendorQueryRecord | null> {
    const row = await this.prismaRead.vendor.findFirst({ where: { id, ...this.sharedScope() } });
    return row ? PrismaVendorMapper.toRecord(row as never) : null;
  }

  async findOrderableById(id: string): Promise<VendorQueryRecord | null> {
    const row = await this.prismaRead.vendor.findFirst({
      where: { id, status: 'ACTIVE' as never, ...this.sharedScope() },
    });
    return row ? PrismaVendorMapper.toRecord(row as never) : null;
  }

  async findOrderableByCodes(codes: string[]): Promise<VendorQueryRecord[]> {
    if (codes.length === 0) return [];
    const rows = await this.prismaRead.vendor.findMany({
      where: { code: { in: codes }, status: 'ACTIVE' as never, ...this.sharedScope() },
    });
    return rows.map((row: never) => PrismaVendorMapper.toRecord(row));
  }

  async findAll(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prismaRead.vendor.findMany({
        where: this.sharedScope(),
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaRead.vendor.count({ where: this.sharedScope() }),
    ]);
    return {
      items: rows.map((row: never) => PrismaVendorMapper.toRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
