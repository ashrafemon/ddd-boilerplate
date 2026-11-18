import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { CachePort } from '../ports/cache.port';
import { CACHEABLE_KEY, CacheableOptions } from '../http/cacheable.decorator';

/**
 * HTTP read cache for routes marked `@Cacheable()`.
 *
 * Caches the value the handler returned (the `{ data, message }` pair) keyed by
 * `tenant:company:http:{resource}:{variant}` where `variant` is the route `:id`
 * (or `list` for id-less routes). Two tenants never share an entry.
 *
 * The interceptor is a no-op unless the route carries `@Cacheable()`, so
 * non-cached routes pay nothing. It is registered as a global APP_INTERCEPTOR
 * in `CacheModule` (gated by the decorator), mirroring `IdempotencyInterceptor`.
 *
 * Fail-open: a cache read error is a MISS and a failed write is swallowed — a
 * route never fails because of the cache.
 */
@Injectable()
export class CacheableInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: CachePort,
    private readonly context: RequestContextPort,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const options =
      this.reflector.get<CacheableOptions | undefined>(CACHEABLE_KEY, context.getHandler()) ??
      this.reflector.get<CacheableOptions | undefined>(CACHEABLE_KEY, context.getClass());
    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (request.method !== 'GET') {
      return next.handle();
    }

    const cacheKey = this.buildKey(request, options.resource);
    const cached = await this.cache.get<unknown>(cacheKey);
    if (cached.status === 'HIT') {
      return of(cached.value);
    }

    return next.handle().pipe(
      tap(data => {
        void this.cache.set(cacheKey, data).catch(() => {
          // fail-open: a failed write must never fail the route
        });
      }),
    );
  }

  private buildKey(request: FastifyRequest, resource?: string): string {
    const id = (request.params as { id?: string }).id;
    return this.cache.buildKey({
      tenantId: this.context.getTenantId(),
      companyId: this.context.getCompanyId(),
      namespace: 'http',
      resource: resource ?? this.deriveResource(request),
      variant: id ?? 'list',
    });
  }

  private deriveResource(request: FastifyRequest): string {
    const segments = (request.originalUrl ?? '').split('/').filter(Boolean);
    // /api/v1/<resource>/...  or  /<resource>/...
    const resourceSegment = segments[2] ?? segments[segments.length - 2] ?? 'default';
    return resourceSegment.replace(/s$/, '');
  }
}
