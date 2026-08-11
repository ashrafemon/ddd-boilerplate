import { Global, Module } from '@nestjs/common';
import { ModulePortAccessor } from './ports/module-port-accessor';
import { NestModulePortAccessor } from './ports/nest-module-port-accessor';

/**
 * Shared kernel — leaf contracts and utilities only: exceptions, validation,
 * result/type helpers and the module port accessor used for cross-module
 * capability resolution.
 *
 * Context, observability, event bus and the HTTP cross-cutting pieces live in
 * the platform layer (ports) and the infrastructure layer (implementations).
 *
 * This module contains only technical/shared concerns — never business logic.
 */
@Global()
@Module({
  providers: [
    { provide: ModulePortAccessor, useClass: NestModulePortAccessor },
  ],
  exports: [ModulePortAccessor],
})
export class SharedKernelModule {}
