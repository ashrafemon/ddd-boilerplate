import { Injectable } from '@nestjs/common';
import { CompanyConfigPort as InvoiceCompanyConfigPort } from '@business/sales/invoice/application/outbound-ports/company-config.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';

@Injectable()
export class CompanyConfigAdapter implements InvoiceCompanyConfigPort {
  constructor(private readonly platformConfig: CompanyConfigPort) {}

  async getCompanyConfig() {
    return this.platformConfig.getCompanyConfig();
  }
}
