/**
 * The authenticated identity resolved from the request context.
 *
 * Populated by the tenancy/auth middleware (or JWT verification in
 * multi-tenancy mode). Business modules consume this through
 * `AuthenticationPort` — no IAM implementation exists yet.
 */
export interface Identity {
  readonly userId: string | null;
  readonly tenantId: string | null;
  readonly companyId: string | null;
  readonly roles: readonly string[];
}

/**
 * Resolves the current authenticated identity from the request context.
 *
 * Port definition only — no implementation (IAM deferred). The platform
 * layer will provide a concrete adapter backed by JWT/tenancy context.
 *
 * Business modules inject this port to know who is making the request and
 * which tenant/company they belong to.
 */
export abstract class AuthenticationPort {
  abstract getIdentity(): Promise<Identity | null>;
}
