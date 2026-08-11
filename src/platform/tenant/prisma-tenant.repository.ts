import { Injectable } from '@nestjs/common';
import { TenantId } from '../../shared-business/value-object/tenant-id';
import { TenantRecord, TenantRepositoryPort } from '../../shared-kernel/ports/tenant/tenant-repository.port';
import { PrismaReadService } from '../../infrastructure/database/prisma/prisma-read.service';

/**
 * Tenant persistence adapter backed by the read Prisma connection.
 */
@Injectable()
export class PrismaTenantRepository implements TenantRepositoryPort {
  constructor(private readonly prismaRead: PrismaReadService) {}

  public async findById(id: TenantId): Promise<TenantRecord | null> {
    const tenant = await this.prismaRead.tenant.findUnique({
      where: { id: id.getValue() },
      select: { id: true, code: true, name: true },
    });
    return tenant;
  }
}
