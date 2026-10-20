import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { CachePort } from '../ports/cache.port';

/**
 * HTTP read cache for GET routes.
 *
 * Caches the value the HANDLER returned (the `{ data, message }` pair a
 * controller builds) — not the transport envelope. The envelope is produced
 * later by `ResponseInterceptor` and the device shape by
 * `DeviceResponseInterceptor`, and both are global interceptors that sit
 * OUTSIDE this one, so they still run on a cache hit: a cached entry renders
 * exactly like a fresh one.
 *
 * The key carries the tenant and the company of the request, so two tenants
 * never share an entry for the same URL. The key shape is
 * `cache:{version}:{tenant}:{company}:http:{url}:{variant}` — build it
 * through `CachePort.buildKey`, never by hand.
 *
 * Fail-open: a cache read error is a MISS and a failed write is swallowed —
 * a route never fails because of the cache.
 *
 * Scope it explicitly on the routes that may be cached
 * (`@UseInterceptors(CacheResponseInterceptor)`); it is not a global
 * interceptor.
 */
@Injectable()
export class CacheResponseInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: CachePort,
    private readonly context: RequestContextPort,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (request.method !== 'GET') {
      return next.handle();
    }

    const cacheKey = this.buildKey(request.originalUrl);

    const cached = await this.cache.get<unknown>(cacheKey);
    if (cached.status === 'HIT') {
      return of(cached.value);
    }

    return next.handle().pipe(
      tap(data => {
        void this.cache.set(cacheKey, data).catch(() => {
          // fail-open
        });
      }),
    );
  }

  private buildKey(url: string): string {
    return this.cache.buildKey({
      tenantId: this.context.getTenantId(),
      companyId: this.context.getCompanyId(),
      namespace: 'http',
      resource: url,
    });
  }
}
