/**
 * Company the platform falls back to when a caller does not name one. Single
 * tenant deployments keep exactly one `company_configs` row with this id.
 */
export const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000000';

export interface CompanyConfig {
  companyId: string;
  companyCode: string;
  companyName: string;
  defaultCurrency: string;
  autoApproveThreshold: number;
  isActive: boolean;
}

export abstract class CompanyConfigPort {
  abstract getCompanyConfig(companyId?: string): Promise<CompanyConfig>;
}
