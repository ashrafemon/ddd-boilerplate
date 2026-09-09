import { Injectable } from '@nestjs/common';
import { CompanyConfigPort as PurchaseOrderCompanyConfigPort } from '@business/procurement/purchase-order/application/outbound-ports/company-config.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';

@Injectable()
export class CompanyConfigOutboundAdapter implements PurchaseOrderCompanyConfigPort {
  constructor(private readonly platformConfig: CompanyConfigPort) {}

  async getCompanyConfig() {
    return this.platformConfig.getCompanyConfig();
  }
}
