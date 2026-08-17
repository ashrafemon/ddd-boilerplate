import { Global, Module } from '@nestjs/common';
import { PrismaCompanyConfigAdapter } from './prisma-company-config.adapter';
import { CompanyConfigPort } from './ports/company-config.port';

/**
 * Configuration sub-system — company/tenant settings resolved before any
 * business use case starts orchestrating. Global so every business module can
 * inject the CompanyConfigPort port anywhere.
 */
@Global()
@Module({
  providers: [
    PrismaCompanyConfigAdapter,
    { provide: CompanyConfigPort, useExisting: PrismaCompanyConfigAdapter },
  ],
  exports: [CompanyConfigPort],
})
export class ConfigurationModule {}
