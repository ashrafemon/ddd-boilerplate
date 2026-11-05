import { Injectable } from '@nestjs/common';
import { AuthenticationPort, Identity } from '../ports/authentication.port';

/**
 * No-op AuthenticationPort adapter (IAM deferred).
 *
 * Returns an empty identity until a real IAM implementation is wired in.
 * Safe for local/dev and for the DI graph to resolve without IAM.
 */
@Injectable()
export class NoopAuthenticationAdapter implements AuthenticationPort {
  getIdentity(): Promise<Identity | null> {
    return Promise.resolve(null);
  }
}
