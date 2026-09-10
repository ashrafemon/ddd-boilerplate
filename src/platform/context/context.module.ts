import { Module } from '@nestjs/common';
import { ClsRequestContextService } from './adapters/cls-request-context.service';
import { RequestContextPort } from './ports/request-context.port';

/**
 * Platform context module — provides the request context implementation
 * backed by nestjs-cls. The CLS store itself is registered (globally) by the
 * infrastructure layer.
 */
@Module({
  providers: [
    ClsRequestContextService,
    { provide: RequestContextPort, useClass: ClsRequestContextService },
  ],
  exports: [RequestContextPort],
})
export class ContextModule {}
