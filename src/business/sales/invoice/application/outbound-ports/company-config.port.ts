import { CompanyConfig } from '@platform/configuration/ports/company-config.port';

/** Module-local company-config port (platform CompanyConfigPort is wrapped by an adapter). */
export abstract class CompanyConfigPort {
  abstract getCompanyConfig(): Promise<CompanyConfig>;
}
