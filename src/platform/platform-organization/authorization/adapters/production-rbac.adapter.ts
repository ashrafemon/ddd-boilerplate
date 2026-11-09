import { Injectable } from '@nestjs/common';
import { RbacPort, RbacCheck } from '../ports/rbac.port';

/**
 * Production RbacPort adapter — fails closed.
 *
 * In production, a real RBAC implementation must be wired in. Without it,
 * every authorization check is denied rather than silently allowed.
 */
@Injectable()
export class ProductionRbacAdapter implements RbacPort {
  can(check: RbacCheck): Promise<boolean> {
    void check;
    return Promise.resolve(false);
  }
}
