import { Module } from '@nestjs/common';
import { ContextModule } from '@platform/context/context.module';
import { PrismaCompanyConfigRepository } from './repositories/company-config.repository';
import { CompanyConfigPort } from './ports/company-config.port';

@Module({
  imports: [ContextModule],
  providers: [
    PrismaCompanyConfigRepository,
    { provide: CompanyConfigPort, useExisting: PrismaCompanyConfigRepository },
  ],
  exports: [CompanyConfigPort],
})
export class ConfigurationModule {}
