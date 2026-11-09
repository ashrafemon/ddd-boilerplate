import { Injectable } from '@nestjs/common';
import { CompanyConfigPort as ProductCompanyConfigPort } from '@business/product-management/product/application/outbound-ports/company-config.port';
import { CompanyConfigPort } from '@platform/platform-organization/configuration/ports/company-config.port';

@Injectable()
export class CompanyConfigAdapter implements ProductCompanyConfigPort {
  constructor(private readonly platformConfig: CompanyConfigPort) {}

  async getCompanyConfig() {
    return this.platformConfig.getCompanyConfig();
  }
}
