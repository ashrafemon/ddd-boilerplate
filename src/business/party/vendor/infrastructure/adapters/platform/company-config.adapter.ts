import { Injectable } from '@nestjs/common';
import { CompanyConfigPort as VendorCompanyConfigPort } from '@business/party/vendor/application/outbound-ports/company-config.port';
import { CompanyConfigPort } from '@platform/platform-organization/configuration/ports/company-config.port';

@Injectable()
export class CompanyConfigAdapter implements VendorCompanyConfigPort {
  constructor(private readonly platformConfig: CompanyConfigPort) {}

  async getCompanyConfig() {
    return this.platformConfig.getCompanyConfig();
  }
}
