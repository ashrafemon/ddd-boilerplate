/**
 * Company the platform falls back to when a caller does not name one. Single
 * tenant deployments keep exactly one `company_configs` row with this id.
 */
// Re-exported from shared-kernel so the business layer and the platform
// resolve the effective company the same way.
export { DEFAULT_COMPANY_ID } from '@shared-kernel/constants/company';

export interface CompanyConfig {
  companyId: string;
  companyCode: string;
  companyName: string;
  defaultCurrency: string;
  autoApproveThreshold: number;
  overReceiptTolerance: number;
  isActive: boolean;
}

export abstract class CompanyConfigPort {
  abstract getCompanyConfig(companyId?: string): Promise<CompanyConfig>;
}
