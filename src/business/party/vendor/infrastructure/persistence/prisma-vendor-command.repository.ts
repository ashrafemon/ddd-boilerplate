import { ConflictException, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Vendor } from '../../domain/aggregates/vendor.aggregate';
import { VendorCommandRepository } from '../../domain/repositories/vendor-command.repository';
import { PrismaVendorMapper } from './prisma-vendor.mapper';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';

@Injectable()
export class PrismaVendorCommandRepository extends VendorCommandRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
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

  async save(vendor: Vendor): Promise<Vendor> {
    await this.txHost.tx.vendor.create({
      data: {
        ...PrismaVendorMapper.toRow(vendor),
        tenantId: this.requestContext.getTenantId(),
        companyId: this.requestContext.getCompanyId(),
      } as never,
    });
    return vendor;
  }

  async update(vendor: Vendor): Promise<Vendor> {
    // Scoped write: `updateMany` (not `update`) so the tenant predicate can
    // join the WHERE clause. Zero rows ⇒ the row is gone or belongs to another
    // tenant — the use case already 404s a foreign row on its scoped read.
    const res = await this.txHost.tx.vendor.updateMany({
      where: { id: vendor.id.toString(), ...this.sharedScope() },
      data: { ...PrismaVendorMapper.toRow(vendor) } as never,
    });
    if (res.count === 0) {
      throw new ConflictException('Vendor was modified concurrently (not found in scope)');
    }
    return vendor;
  }

  async findById(id: string): Promise<Vendor | null> {
    const row = await this.txHost.tx.vendor.findFirst({
      where: { id, ...this.sharedScope() },
    });
    return row ? PrismaVendorMapper.toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Vendor | null> {
    const row = await this.txHost.tx.vendor.findFirst({
      where: { code, ...this.sharedScope() },
    });
    return row ? PrismaVendorMapper.toDomain(row) : null;
  }
}
