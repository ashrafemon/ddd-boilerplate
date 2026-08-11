import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AbstractPortType, ModulePortAccessor } from './module-port-accessor';

/**
 * Infrastructure implementation of ModulePortAccessor. Resolves application
 * ports of other modules through the NestJS container with `strict: false`.
 *
 * Business/application code never uses ModuleRef directly — it depends on the
 * ModulePortAccessor abstraction only.
 */
@Injectable()
export class NestModulePortAccessor implements ModulePortAccessor {
  constructor(private readonly moduleRef: ModuleRef) {}

  public resolve<TPort extends object>(port: AbstractPortType<TPort>): TPort {
    return this.moduleRef.get<TPort>(port, { strict: false });
  }
}
