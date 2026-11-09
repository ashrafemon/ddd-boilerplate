import { Injectable } from '@nestjs/common';
import { FeatureGate } from '../ports/feature-gate.port';

/**
 * Fail-closed default: until an entitlement source is wired (module provider /
 * composition-root override), no capability keys are enabled, so no saga starts.
 * Replacing this provider — never editing it — turns sagas on.
 */
@Injectable()
export class EmptyFeatureGate extends FeatureGate {
  enabled(): Promise<ReadonlySet<string>> {
    return Promise.resolve(new Set<string>());
  }
}
