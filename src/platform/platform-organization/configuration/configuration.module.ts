import { Module } from '@nestjs/common';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { CompanyConfigContextMiddleware } from '@shared-kernel/middleware/company-config-context.middleware';
import { PrismaCompanyConfigRepository } from './repositories/company-config.repository';
import { CompanyConfigPort } from './ports/company-config.port';

@Module({
  imports: [ContextModule],
  providers: [
    PrismaCompanyConfigRepository,
    CompanyConfigContextMiddleware,
    { provide: CompanyConfigPort, useExisting: PrismaCompanyConfigRepository },
  ],
  exports: [CompanyConfigPort, CompanyConfigContextMiddleware],
})
export class ConfigurationModule {}
