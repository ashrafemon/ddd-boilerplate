import { CompanyConfig } from '@platform/platform-organization/configuration/ports/company-config.port';

export abstract class CompanyConfigPort {
  abstract getCompanyConfig(): Promise<CompanyConfig>;
}
