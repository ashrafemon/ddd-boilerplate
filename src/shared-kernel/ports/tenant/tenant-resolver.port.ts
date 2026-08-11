import { TenantContext } from '../../../platform/tenant/tenant-context';

export interface TenantResolutionResult {
  tenant: TenantContext;
  source: 'context' | 'header';
}

/**
 * Resolves the current tenant for the active request/message.
 */
export abstract class TenantResolverPort {
  public abstract resolve(): Promise<TenantContext>;
  public abstract getCurrentTenantId(): string | undefined;
}
