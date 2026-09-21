import { Injectable } from '@nestjs/common';
import { PrismaWriteService } from '@infrastructure/database/prisma/prisma-write.service';
import { DistributedLockRepositoryPort } from '../ports/distributed-lock-repository.port';
import { DistributedLockIdentity, DistributedLockRecord } from '../locking.types';

/**
 * PostgreSQL-backed lock metadata repository.
 * Maintains the fencing token sequence per lock resource using atomic upsert + increment.
 */
@Injectable()
export class PrismaDistributedLockRepository implements DistributedLockRepositoryPort {
  constructor(private readonly prisma: PrismaWriteService) {}

  async getOrCreate(identity: DistributedLockIdentity): Promise<DistributedLockRecord> {
    const row = await this.prisma.distributedLock.upsert({
      where: {
        tenantId_organizationId_scope_resource: {
          tenantId: identity.tenantId,
          organizationId: identity.organizationId,
          scope: identity.scope,
          resource: identity.resource,
        },
      },
      create: {
        tenantId: identity.tenantId,
        organizationId: identity.organizationId,
        scope: identity.scope,
        resource: identity.resource,
        fencingToken: 0,
      },
      update: {},
    });

    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      scope: row.scope,
      resource: row.resource,
      fencingToken: Number(row.fencingToken),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async nextFencingToken(identity: DistributedLockIdentity): Promise<number> {
    const row = await this.prisma.distributedLock.upsert({
      where: {
        tenantId_organizationId_scope_resource: {
          tenantId: identity.tenantId,
          organizationId: identity.organizationId,
          scope: identity.scope,
          resource: identity.resource,
        },
      },
      create: {
        tenantId: identity.tenantId,
        organizationId: identity.organizationId,
        scope: identity.scope,
        resource: identity.resource,
        fencingToken: 1,
      },
      update: {
        fencingToken: { increment: 1 },
      },
    });

    return Number(row.fencingToken);
  }
}
