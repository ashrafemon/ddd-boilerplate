import { Injectable } from '@nestjs/common';
import { CompanyConfigOutboundPort } from '@business/procurement/purchase/application/outbound-ports/company-config.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';

@Injectable()
export class CompanyConfigOutboundAdapter implements CompanyConfigOutboundPort {
  constructor(private readonly platformConfig: CompanyConfigPort) {}

  async getCompanyConfig() {
    return this.platformConfig.getCompanyConfig();
  }
}