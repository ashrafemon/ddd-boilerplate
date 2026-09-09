import { Module } from '@nestjs/common';
import { PrismaCompanyConfigAdapter } from './prisma-company-config.adapter';
import { CompanyConfigPort } from './ports/company-config.port';

@Module({
  providers: [
    PrismaCompanyConfigAdapter,
    { provide: CompanyConfigPort, useExisting: PrismaCompanyConfigAdapter },
  ],
  exports: [CompanyConfigPort],
})
export class ConfigurationModule {}
