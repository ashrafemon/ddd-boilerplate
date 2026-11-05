import { Injectable } from '@nestjs/common';
import { RbacPort, RbacCheck } from '../ports/rbac.port';

/**
 * No-op RbacPort adapter (IAM deferred).
 *
 * Fail-open: every action is permitted until a real IAM implementation is
 * wired in. Safe for local/dev and for the DI graph to resolve without IAM.
 */
@Injectable()
export class NoopRbacAdapter implements RbacPort {
  can(check: RbacCheck): Promise<boolean> {
    void check;
    return Promise.resolve(true);
  }
}
