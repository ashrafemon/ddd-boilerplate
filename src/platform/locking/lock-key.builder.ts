import { Injectable } from '@nestjs/common';
import { DistributedLockIdentity } from './locking.types';

/**
 * Deterministic lock key builder.
 *
 * Produces keys in the format:
 * ```
 * {tenantId}:{companyId}:{scope}:{resource}
 * ```
 *
 * Example:
 * ```
 * tenant-001:company-001:inventory.stock:product-123
 * ```
 */
@Injectable()
export class LockKeyBuilder {
  build(identity: DistributedLockIdentity): string {
    return [identity.tenantId, identity.companyId, identity.scope, identity.resource].join(':');
  }
}
