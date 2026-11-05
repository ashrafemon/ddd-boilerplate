import { Module } from '@nestjs/common';
import { NoopAbacAdapter } from './adapters/noop-abac.adapter';
import { NoopRbacAdapter } from './adapters/noop-rbac.adapter';
import { AbacPort } from './ports/abac.port';
import { RbacPort } from './ports/rbac.port';

@Module({
  providers: [
    NoopAbacAdapter,
    NoopRbacAdapter,
    { provide: AbacPort, useExisting: NoopAbacAdapter },
    { provide: RbacPort, useExisting: NoopRbacAdapter },
  ],
  exports: [AbacPort, RbacPort],
})
export class AuthorizationModule {}
