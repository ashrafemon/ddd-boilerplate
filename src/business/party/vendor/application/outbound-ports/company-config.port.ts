import { CompanyConfig } from '@platform/configuration/ports/company-config.port';

export abstract class CompanyConfigPort {
  abstract getCompanyConfig(): Promise<CompanyConfig>;
}
