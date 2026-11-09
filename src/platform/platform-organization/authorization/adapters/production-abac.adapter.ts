import { Injectable } from '@nestjs/common';
import { AbacPort, AbacCheck, AbacResult } from '../ports/abac.port';

/**
 * Production AbacPort adapter — fails closed.
 *
 * In production, a real ABAC implementation must be wired in. Without it,
 * every ABAC evaluation is denied rather than silently allowed.
 */
@Injectable()
export class ProductionAbacAdapter implements AbacPort {
  evaluate(check: AbacCheck): Promise<AbacResult> {
    void check;
    return Promise.resolve({ decision: 'DENY', reason: 'ABAC not implemented' });
  }
}
