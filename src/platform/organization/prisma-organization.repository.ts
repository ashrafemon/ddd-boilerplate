import { Injectable } from '@nestjs/common';
import { OrganizationId } from '../../shared-business/value-object/organization-id';
import { TenantId } from '../../shared-business/value-object/tenant-id';
import {
  OrganizationRecord,
  OrganizationRepositoryPort,
} from '../../shared-kernel/ports/organization/organization-repository.port';
import { PrismaReadService } from '../../infrastructure/database/prisma/prisma-read.service';

/**
 * Organization persistence adapter backed by the read Prisma connection.
 * Tenant and organization are both required so records are always fetched
 * within the correct tenancy boundary.
 */
@Injectable()
export class PrismaOrganizationRepository implements OrganizationRepositoryPort {
  constructor(private readonly prismaRead: PrismaReadService) {}

  public async findById(
    tenantId: TenantId,
    id: OrganizationId,
  ): Promise<OrganizationRecord | null> {
    const organization = await this.prismaRead.organization.findFirst({
      where: { id: id.getValue(), tenantId: tenantId.getValue() },
      select: {
        id: true,
        tenantId: true,
        code: true,
        name: true,
        config: true,
        isActive: true,
      },
    });

    if (!organization) return null;

    return {
      id: organization.id,
      tenantId: organization.tenantId,
      code: organization.code,
      name: organization.name,
      config: organization.config as Record<string, unknown> | null,
      isActive: organization.isActive,
    };
  }
}
