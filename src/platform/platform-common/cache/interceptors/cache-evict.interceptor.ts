import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { CachePort } from '../ports/cache.port';
import { CACHE_EVICT_KEY, CacheEvictOptions } from '../http/cache-evict.decorator';

/**
 * HTTP cache eviction for routes marked `@CacheEvict()`.
 *
 * After the handler succeeds, the `{ resource, :id }` cache entry is evicted so
 * the next read fetches fresh data. The interceptor is a no-op unless the route
 * carries `@CacheEvict()`. Registered as a global APP_INTERCEPTOR in
 * `CacheModule` (gated by the decorator).
 *
 * Fail-open: a failed eviction is swallowed — a route never fails because of
 * the cache. Eviction runs only on a successful handler outcome.
 */
@Injectable()
export class CacheEvictInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: CachePort,
    private readonly context: RequestContextPort,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const options =
      this.reflector.get<CacheEvictOptions | undefined>(CACHE_EVICT_KEY, context.getHandler()) ??
      this.reflector.get<CacheEvictOptions | undefined>(CACHE_EVICT_KEY, context.getClass());
    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const cacheKey = this.buildKey(request, options.resource);

    return next.handle().pipe(
      tap(() => {
        void this.cache.delete(cacheKey).catch(() => {
          // fail-open: a failed eviction must never fail the route
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
    const resourceSegment = segments[2] ?? segments[segments.length - 2] ?? 'default';
    return resourceSegment.replace(/s$/, '');
  }
}
