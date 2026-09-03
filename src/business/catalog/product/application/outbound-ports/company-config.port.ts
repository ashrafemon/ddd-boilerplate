import { CompanyConfig } from '@platform/configuration/ports/company-config.port';

export abstract class CompanyConfigOutboundPort {
  abstract getCompanyConfig(): Promise<CompanyConfig>;
}
