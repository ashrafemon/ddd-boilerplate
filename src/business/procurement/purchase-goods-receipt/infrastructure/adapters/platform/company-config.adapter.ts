import { Injectable } from '@nestjs/common';
import { CompanyConfigPort as GrnCompanyConfigPort } from '@business/procurement/purchase-goods-receipt/application/outbound-ports/company-config.port';
import { CompanyConfigPort } from '@platform/platform-organization/configuration/ports/company-config.port';

@Injectable()
export class CompanyConfigAdapter implements GrnCompanyConfigPort {
  constructor(private readonly platformConfig: CompanyConfigPort) {}

  async getCompanyConfig() {
    return this.platformConfig.getCompanyConfig();
  }
}
