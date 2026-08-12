import { Global, Module } from '@nestjs/common';
import { PrismaCompanyConfigAdapter } from './prisma-company-config.adapter';
import { COMPANY_CONFIG } from './ports/company-config.port';

/**
 * Configuration sub-system — company/tenant settings resolved before any
 * business use case starts orchestrating. Global so every business module can
 * inject the COMPANY_CONFIG port token anywhere.
 */
@Global()
@Module({
  providers: [
    PrismaCompanyConfigAdapter,
    { provide: COMPANY_CONFIG, useExisting: PrismaCompanyConfigAdapter },
  ],
  exports: [COMPANY_CONFIG],
})
export class ConfigurationModule {}
