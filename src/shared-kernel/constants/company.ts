/**
 * The company a request belongs to.
 *
 * A business document is owned by a COMPANY, and its natural key (order
 * number, GRN number, SKU, vendor code, invoice number) is unique WITHIN
 * that company — not globally. The numbering series is company-scoped for
 * the same reason: two companies each start their own `PO-00000001`.
 *
 * The company is resolved from the request context: the explicit company, else
 * the tenant (a single-company deployment identifies the company by its
 * tenant), else the default company.
 */
export const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000000';

export interface CompanyScopedContext {
  companyId?: string;
  tenantId?: string;
}

/** The effective company of the current request — never empty. */
export function resolveCompanyId(context?: CompanyScopedContext | null): string {
  return context?.companyId ?? context?.tenantId ?? DEFAULT_COMPANY_ID;
}
