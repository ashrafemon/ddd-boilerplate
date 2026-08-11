import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { TenantRepositoryPort } from '../../shared-kernel/ports/tenant/tenant-repository.port';
import { PrismaTenantRepository } from './prisma-tenant.repository';
import { TenantResolverPort } from '../../shared-kernel/ports/tenant/tenant-resolver.port';
import { TenantResolverService } from './tenant-resolver.service';

/**
 * Platform tenancy module. Resolves the current tenant from the request
 * context and owns the tenant repository (ports + Prisma implementation).
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    TenantResolverService,
    { provide: TenantResolverPort, useClass: TenantResolverService },
    { provide: TenantRepositoryPort, useClass: PrismaTenantRepository },
  ],
  exports: [TenantResolverPort, TenantRepositoryPort],
})
export class TenantModule {}
