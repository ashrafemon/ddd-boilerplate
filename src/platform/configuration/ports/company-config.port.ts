/**
 * Company configuration — the settings a business use case resolves FIRST when
 * orchestrating a request (currency, approval thresholds, enabled features).
 * Provided by the platform so business aggregates never read config tables or
 * `process.env` themselves.
 */
export interface CompanyConfig {
  companyId: string;
  companyCode: string;
  companyName: string;
  defaultCurrency: string;
  autoApproveThreshold: number;
  isActive: boolean;
}

export interface CompanyConfigPort {
  getCompanyConfig(companyId?: string): Promise<CompanyConfig>;
}

export const COMPANY_CONFIG = Symbol('COMPANY_CONFIG');
