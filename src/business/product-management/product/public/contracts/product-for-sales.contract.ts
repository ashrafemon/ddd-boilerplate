export interface ProductReference {
  id: string;
  sku: string;
  name: string;
  status: string;
  companyId: string;
  tenantId: string | null;
}
