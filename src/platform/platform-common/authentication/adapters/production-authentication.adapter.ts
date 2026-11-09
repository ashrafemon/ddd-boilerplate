import { Injectable } from '@nestjs/common';
import { AuthenticationPort, Identity } from '../ports/authentication.port';

/**
 * Production AuthenticationPort adapter — fails closed.
 *
 * In production, a real IAM implementation must be wired in. Without it,
 * every authentication attempt fails rather than silently returning null.
 */
@Injectable()
export class ProductionAuthenticationAdapter implements AuthenticationPort {
  getIdentity(): Promise<Identity | null> {
    throw new Error(
      'Authentication not implemented: configure a real AuthenticationPort adapter for production',
    );
  }
}
