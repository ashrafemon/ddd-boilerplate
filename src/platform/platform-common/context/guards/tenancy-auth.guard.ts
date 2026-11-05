import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@config/config.service';
import { SKIP_TENANCY_KEY } from '@shared-kernel/decorators/skip-tenancy.decorator';

/** Key under which the guard stashes the verified identity on the raw request. */
export const VERIFIED_IDENTITY_REQUEST_KEY = 'verifiedIdentity';

export interface VerifiedIdentity {
  tenantId?: string;
  companyId?: string;
  userId?: string;
  roles: string[];
}

interface TenantJwtClaims {
  sub?: string;
  tenantId?: string;
  companyId?: string;
  roles?: string[] | string;
}

/**
 * Trust boundary for multi-tenant deployments.
 *
 * - `TENANCY_MODE=single` (default): pass-through — identity headers remain
 *   trusted for internal/dev use or behind a verified gateway.
 * - `TENANCY_MODE=multi`: every non-skipped route must present
 *   `Authorization: Bearer <jwt>` signed with JWT_ACCESS_SECRET and carrying a
 *   `tenantId` claim. Raw identity headers are then ignored by the
 *   RequestIdInterceptor, which reads the identity stashed here instead.
 */
@Injectable()
export class TenancyAuthGuard implements CanActivate {
  private readonly jwt = new JwtService({});

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.getSecurity().tenancy.mode !== 'multi') {
      return true;
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANCY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    interface HeaderedRequest {
      headers?: Record<string, string | string[] | undefined>;
      [VERIFIED_IDENTITY_REQUEST_KEY]?: VerifiedIdentity;
    }
    // The guard is global, so it also sees the platform's non-HTTP
    // transports (RabbitMQ/Kafka/SQS handlers, workers, crons). There is no
    // bearer token on a message — the identity travels in the envelope — so
    // the HTTP trust boundary simply does not apply there.
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<HeaderedRequest>();
    const auth = request.headers?.['authorization'];
    const header = Array.isArray(auth) ? auth[0] : auth;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let claims: TenantJwtClaims;
    try {
      claims = await this.jwt.verifyAsync<TenantJwtClaims>(header.slice(7), {
        secret: this.config.getAuth().jwt.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!claims.tenantId) {
      throw new ForbiddenException('Token is missing the tenantId claim');
    }

    const identity: VerifiedIdentity = {
      tenantId: claims.tenantId,
      companyId: claims.companyId,
      userId: claims.sub,
      roles: Array.isArray(claims.roles)
        ? claims.roles
        : (claims.roles ?? '')
            .split(',')
            .map(r => r.trim())
            .filter(Boolean),
    };
    request[VERIFIED_IDENTITY_REQUEST_KEY] = identity;
    return true;
  }
}
