/**
 * CompanySettingsReader — company settings owned outside the saga
 * (`grnSources`, `costingMethod`, accrual flags, …). Read at plan build and
 * snapshotted into the instance context, so a later settings change never
 * affects a running instance.
 */
export abstract class CompanySettingsReader {
  abstract get(companyId: string): Promise<Record<string, unknown>>;
}
