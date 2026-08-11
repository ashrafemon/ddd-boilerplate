import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { OrganizationRepositoryPort } from '../../shared-kernel/ports/organization/organization-repository.port';
import { PrismaOrganizationRepository } from './prisma-organization.repository';
import { OrganizationResolverPort } from '../../shared-kernel/ports/organization/organization-resolver.port';
import { OrganizationResolverService } from './organization-resolver.service';

/**
 * Platform organization module. Resolves the current organization from the
 * request context and owns the organization repository (ports + Prisma
 * implementation).
 *
 * Organization configuration lives in the platform configuration module.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    OrganizationResolverService,
    { provide: OrganizationResolverPort, useClass: OrganizationResolverService },
    { provide: OrganizationRepositoryPort, useClass: PrismaOrganizationRepository },
  ],
  exports: [OrganizationResolverPort, OrganizationRepositoryPort],
})
export class OrganizationModule {}
