export interface CacheKeyScope {
  tenantId?: string;
  organizationId?: string;
}

/**
 * Builds a cache key that is scoped to tenant/organization so records of one
 * tenant can never be read by another.
 */
export function buildCacheKey(
  namespace: string,
  scope: CacheKeyScope,
  key: string,
): string {
  const scopePart = [scope.tenantId, scope.organizationId].filter(Boolean).join(':');
  return scopePart ? `${namespace}:${scopePart}:${key}` : `${namespace}:${key}`;
}
