import { Injectable } from '@nestjs/common';
import { AbacPort, AbacCheck, AbacResult } from '../ports/abac.port';

/**
 * No-op AbacPort adapter (IAM deferred).
 *
 * Fail-open: every request is ALLOWed with an empty scope filter until a
 * real IAM implementation is wired in. Safe for local/dev and for the DI
 * graph to resolve without IAM.
 */
@Injectable()
export class NoopAbacAdapter implements AbacPort {
  evaluate(check: AbacCheck): Promise<AbacResult> {
    void check;
    return Promise.resolve({ decision: 'ALLOW', scopeFilter: {} });
  }
}
