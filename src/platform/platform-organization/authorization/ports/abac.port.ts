export interface AbacContext {
  tenantId: string;
  companyId: string;
  userId: string;
  roles: string[];
  [key: string]: unknown;
}

export interface AbacResult {
  decision: 'ALLOW' | 'DENY';
  scopeFilter?: Record<string, unknown>;
  reason?: string;
}

export interface AbacCheck {
  context: AbacContext;
  resource: string;
  action: string;
  scopeFilter?: Record<string, unknown>;
}

/**
 * Attribute-based access control port.
 *
 * Port definition only — no implementation (IAM deferred). The platform
 * layer will provide a concrete adapter backed by attribute policies.
 *
 * Business modules inject this port to evaluate fine-grained access
 * decisions based on request context, resource attributes, and action.
 */
export abstract class AbacPort {
  abstract evaluate(check: AbacCheck): Promise<AbacResult>;
}
