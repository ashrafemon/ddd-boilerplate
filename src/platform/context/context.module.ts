import { Global, Module } from '@nestjs/common';
import { RequestContextMiddleware } from './request-context.middleware';

/**
 * Platform context module. Provides the request context middleware that
 * populates the context from HTTP headers. The CLS-backed implementation of
 * the `RequestContextPort` and the nestjs-cls initialization live in the
 * infrastructure context module.
 */
@Global()
@Module({
  providers: [RequestContextMiddleware],
  exports: [RequestContextMiddleware],
})
export class PlatformContextModule {}
