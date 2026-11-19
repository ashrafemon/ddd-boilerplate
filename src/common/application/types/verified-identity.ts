/**
 * The identity a verified trust boundary (JWT in `TENANCY_MODE=multi`) hands to
 * the rest of the request pipeline.
 *
 * Lives in `common` because two layers meet on it and neither owns the other:
 * the platform tenancy guard writes it onto the raw request
 * (`platform-common/tenancy/http/tenancy-auth.guard.ts`) and the common request
 * interceptor reads it to seed the CLS request context. Keeping it here stops
 * `src/common` from having to import a platform *guard* file just to learn a
 * property key.
 */
export const VERIFIED_IDENTITY_REQUEST_KEY = 'verifiedIdentity';

export interface VerifiedIdentity {
  tenantId?: string;
  companyId?: string;
  userId?: string;
  roles: string[];
}
