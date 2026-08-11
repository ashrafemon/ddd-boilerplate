import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextPort } from '../../ports/context/request-context.port';
import { IS_PUBLIC_KEY } from '../decorator/public.decorator';
import { UnauthorizedException } from '../../exceptions/unauthorized.exception';

/**
 * Demo authentication guard.
 *
 * In a real deployment this guard is replaced by an identity provider
 * integration. It requires a `userId` to be present in the request context
 * (populated by the RequestContextInterceptor from the `x-user-id` header)
 * unless the route is marked @Public.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContextPort,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (!this.requestContext.isAvailable() || !this.requestContext.getUserId()) {
      throw new UnauthorizedException('Missing or invalid user context');
    }

    return true;
  }
}
