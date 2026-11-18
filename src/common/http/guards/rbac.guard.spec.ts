import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard } from './rbac.guard';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';

function context(): ExecutionContext {
  return { getHandler: () => () => undefined } as unknown as ExecutionContext;
}

describe('RbacGuard security', () => {
  let guard: RbacGuard;
  const reflector = { get: jest.fn() };
  const rbac = { can: jest.fn() };
  const requestContext = { get: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RbacGuard(
      reflector as unknown as Reflector,
      rbac,
      requestContext as unknown as RequestContextPort,
    );
  });

  it('allows routes without RBAC metadata', async () => {
    reflector.get.mockReturnValue(undefined);
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('denies when there is no authenticated user', async () => {
    reflector.get.mockReturnValue({ resource: 'Vendor', action: 'create' });
    requestContext.get.mockReturnValue(undefined);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies when RBAC rejects the action', async () => {
    reflector.get.mockReturnValue({ resource: 'Vendor', action: 'create' });
    requestContext.get.mockReturnValue({ userId: 'u-1' });
    rbac.can.mockResolvedValue(false);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows when RBAC approves the action', async () => {
    reflector.get.mockReturnValue({ resource: 'Vendor', action: 'create' });
    requestContext.get.mockReturnValue({ userId: 'u-1' });
    rbac.can.mockResolvedValue(true);
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });
});
