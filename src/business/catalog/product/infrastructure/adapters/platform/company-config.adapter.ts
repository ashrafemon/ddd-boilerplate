import { Injectable } from '@nestjs/common';
import { CompanyConfigPort as ProductCompanyConfigPort } from '@business/catalog/product/application/outbound-ports/company-config.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';

@Injectable()
export class CompanyConfigAdapter implements ProductCompanyConfigPort {
  constructor(private readonly platformConfig: CompanyConfigPort) {}

  async getCompanyConfig() {
    return this.platformConfig.getCompanyConfig();
  }
}
