import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { PrismaReadService } from '../../../../../infrastructure/database/prisma/prisma-read.service';
import {
  VendorReadModel,
  VendorReadRepositoryPort,
} from '../../../domain/port/vendor-read-repository.port';
import { VendorMapper } from '../vendor.mapper';

/**
 * Read-side repository for vendors, scoped to the current tenant.
 */
@Injectable()
export class PrismaVendorReadRepositoryAdapter implements VendorReadRepositoryPort {
  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly requestContext: RequestContextPort,
  ) {}

  public async findById(id: string): Promise<VendorReadModel | null> {
    const tenantId = this.requestContext.getTenantId();
    const row = await this.prismaRead.vendor.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      include: { addresses: true },
    });
    return row ? VendorMapper.toReadModel(row) : null;
  }

  public async findByIds(ids: string[]): Promise<VendorReadModel[]> {
    if (ids.length === 0) return [];
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.prismaRead.vendor.findMany({
      where: { id: { in: ids }, ...(tenantId ? { tenantId } : {}) },
      include: { addresses: true },
    });
    return rows.map(VendorMapper.toReadModel);
  }

  public async findByCode(
    tenantId: string,
    organizationId: string,
    code: string,
  ): Promise<VendorReadModel | null> {
    const row = await this.prismaRead.vendor.findFirst({
      where: { tenantId, organizationId, code: code.trim().toUpperCase() },
      include: { addresses: true },
    });
    return row ? VendorMapper.toReadModel(row) : null;
  }
}

export type VendorRow = Prisma.VendorGetPayload<{ include: { addresses: true } }>;
