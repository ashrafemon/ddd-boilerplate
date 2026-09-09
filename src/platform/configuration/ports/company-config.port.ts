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
