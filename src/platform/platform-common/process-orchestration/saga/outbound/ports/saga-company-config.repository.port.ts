import { SagaCompanyConfigRecord } from '../../types/saga.types';

/**
 * Outbound port: the `saga_company_configs` table (one ACTIVE overlay per
 * company and saga). Overlays only narrow the platform default.
 */
export abstract class SagaCompanyConfigRepositoryPort {
  abstract findActive(
    tenantId: string,
    companyId: string,
    sagaKey: string,
  ): Promise<SagaCompanyConfigRecord | null>;

  /** Re-validation failed: park the overlay INVALID so the default applies. */
  abstract markInvalid(id: string): Promise<void>;
}
