import { Module } from '@nestjs/common';
import { PrismaCompanyConfigRepository } from './repositories/company-config.repository';
import { CompanyConfigPort } from './ports/company-config.port';

@Module({
  providers: [
    PrismaCompanyConfigRepository,
    { provide: CompanyConfigPort, useExisting: PrismaCompanyConfigRepository },
  ],
  exports: [CompanyConfigPort],
})
export class ConfigurationModule {}
