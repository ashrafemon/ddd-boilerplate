import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { ClsRequestContextService } from './adapters/cls-request-context.service';
import { NestModulePortResolver } from './adapters/nest-module-port-resolver';
import { RequestContextPort } from './ports/request-context.port';
import { ModulePortResolver } from './ports/module-port-resolver.port';

/**
 * Platform context module — provides the request context and module
 * port resolver implementations backed by nestjs-cls and NestJS ModuleRef.
 */
@Global()
@Module({
  imports: [ClsModule],
  providers: [
    ClsRequestContextService,
    NestModulePortResolver,
    { provide: RequestContextPort, useClass: ClsRequestContextService },
    { provide: ModulePortResolver, useExisting: NestModulePortResolver },
  ],
  exports: [RequestContextPort, ModulePortResolver],
})
export class ContextModule {}
