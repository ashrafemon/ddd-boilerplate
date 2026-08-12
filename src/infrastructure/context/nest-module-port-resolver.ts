import { Injectable, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  MODULE_PORT_RESOLVER,
  ModulePortResolver,
} from '@business/shared-business/ports/module-port-resolver.port';

/**
 * NestJS implementation of {@link ModulePortResolver}. Uses `ModuleRef.get` to
 * resolve the concrete adapter registered for a port token. `strict: false`
 * lets it scan the whole application container, so cross-aggregate calls only
 * need the token — no module imports.
 */
@Injectable()
export class NestModulePortResolver implements ModulePortResolver {
  constructor(private readonly moduleRef: ModuleRef) {}

  public resolvePort<TPort>(
    token: symbol | string | (abstract new (...args: never[]) => TPort),
  ): TPort {
    return this.moduleRef.get<TPort>(token, { strict: false });
  }
}

export const injectModulePortResolver = Inject(MODULE_PORT_RESOLVER);
