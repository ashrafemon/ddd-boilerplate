import { Module } from '@nestjs/common';
import { ClsRequestContextService } from './adapters/cls-request-context.service';
import { NestModulePortResolver } from './adapters/nest-module-port-resolver';
import { RequestContextPort } from './ports/request-context.port';
import { ModulePortResolver } from './ports/module-port-resolver.port';

/**
 * Platform context module — provides the request context and module
 * port resolver implementations backed by nestjs-cls and NestJS ModuleRef.
 * The CLS store itself is registered (globally) by the infrastructure layer.
 */
@Module({
  providers: [
    ClsRequestContextService,
    NestModulePortResolver,
    { provide: RequestContextPort, useClass: ClsRequestContextService },
    { provide: ModulePortResolver, useExisting: NestModulePortResolver },
  ],
  exports: [RequestContextPort, ModulePortResolver],
})
export class ContextModule {}
