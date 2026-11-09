import { CompanyConfigPort } from '@platform/platform-organization/configuration/ports/company-config.port';
import { Injectable } from '@nestjs/common';
import { CompanyConfig } from '@platform/platform-organization/configuration/ports/company-config.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { DEFAULT_COMPANY_ID } from '@common/application/constants/company';

@Injectable()
export class CompanyConfigAdapter implements CompanyConfigPort {
  constructor(private readonly requestContext: RequestContextPort) {}

  getCompanyConfig(companyId?: string): Promise<CompanyConfig> {
    const ctx = this.requestContext.get();
    const id = companyId ?? ctx?.companyId ?? DEFAULT_COMPANY_ID;
    return Promise.resolve({
      companyId: id,
      companyCode: id,
      companyName: 'Default Company',
      defaultCurrency: ctx?.defaultCurrency ?? 'USD',
      autoApproveThreshold: ctx?.autoApproveThreshold ?? 0,
      overReceiptTolerance: ctx?.overReceiptTolerance ?? 0,
      isActive: true,
    });
  }
}
