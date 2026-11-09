import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacPort } from '@platform/platform-organization/authorization/ports/rbac.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RBAC_KEY } from '@common/http/decorators/rbac.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.get<{ resource: string; action: string } | undefined>(
      RBAC_KEY,
      context.getHandler(),
    );
    if (!metadata) {
      return true;
    }

    const ctx = this.requestContext.get();
    const userId = ctx?.userId;
    if (!userId) {
      throw new ForbiddenException('No authenticated user');
    }

    const allowed = await this.rbac.can({
      userId,
      resource: metadata.resource,
      action: metadata.action,
    });

    if (!allowed) {
      throw new ForbiddenException(`RBAC denied: ${metadata.action} on ${metadata.resource}`);
    }

    return true;
  }
}
