import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextPort } from '../../ports/context/request-context.port';
import { ROLES_KEY } from '../decorator/roles.decorator';
import { ForbiddenException } from '../../exceptions/forbidden.exception';

/**
 * Role-based authorization guard. Reads the roles attached to the route via
 * @Roles(...) and compares them against the roles in the request context.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContextPort,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const contextRoles = this.requestContext.get()?.roles ?? [];
    const hasRole = requiredRoles.some((role) => contextRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(`Requires one of roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
