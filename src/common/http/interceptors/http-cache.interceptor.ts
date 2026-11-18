import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Cache } from 'cache-manager';
import { FastifyRequest } from 'fastify';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import {
  HTTP_CACHE_EVICT_KEY,
  HttpCacheEvictOptions,
} from '../decorators/http-cache-evict.decorator';
import { HTTP_CACHEABLE_KEY, HttpCacheableOptions } from '../decorators/http-cacheable.decorator';

const KEY_NAMESPACE = 'http';

/**
 * Logical identity of one cached response. `url` is the full request URL, so
 * the query string is part of the identity.
 */
export interface HttpCacheIdentity {
  tenantId?: string;
  companyId?: string;
  method: string;
  url: string;
}

/**
 * Builds the cache key for one response.
 *
 * Every part is percent-encoded before joining: a tenant id containing `:`
 * must not be able to impersonate an extra key segment (the same collision that
 * bit the idempotency and data-cache keys).
 */
export function buildHttpCacheKey(identity: HttpCacheIdentity): string {
  return [
    KEY_NAMESPACE,
    identity.tenantId ?? 'platform',
    identity.companyId ?? 'platform',
    identity.method.toUpperCase(),
    identity.url,
  ]
    .map(encodeURIComponent)
    .join(':');
}

/**
 * HTTP response cache driver (NestJS `cache-manager`), opt-in per route.
 *
 * This is the **request/response** cache and nothing else: it stores what a
 * controller returned for a URL. Domain data is cached by the platform cache
 * module (`CachePort`) inside the use cases that own it. Keeping the two apart
 * means an HTTP entry never becomes an accidental source of truth for a
 * background job, and a data cache is never keyed by a URL.
 *
 *   @Get(':id')  @HttpCacheable()      → serve the second request from memory
 *   @Patch(':id') @HttpCacheEvict()    → drop it after a successful write
 *
 * No-op unless the route carries one of the decorators, and inert while
 * `HTTP_CACHE_ENABLED=false`. Fail-open: a store error is a MISS and a failed
 * write/eviction is swallowed, so the cache can never fail a request.
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly configService: ConfigService,
    private readonly context: RequestContextPort,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const evict = this.metadata<HttpCacheEvictOptions>(context, HTTP_CACHE_EVICT_KEY);
    const cacheable = this.metadata<HttpCacheableOptions>(context, HTTP_CACHEABLE_KEY);
    if (!evict && !cacheable) {
      return next.handle();
    }
    if (!this.configService.getHttpCache().enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (evict) {
      return next.handle().pipe(
        tap(() => {
          void this.evict(request, evict).catch(() => undefined);
        }),
      );
    }

    if (request.method !== 'GET') {
      return next.handle();
    }

    const key = this.keyFor(request, request.originalUrl);
    const hit = await this.read(key);
    if (hit !== undefined) {
      return of(hit);
    }

    return next.handle().pipe(
      tap(data => {
        const ttl = cacheable?.ttlMs ?? this.configService.getHttpCache().ttlMs;
        void this.cache.set(key, data, ttl).catch(() => undefined);
      }),
    );
  }

  private async read(key: string): Promise<unknown> {
    try {
      return await this.cache.get<unknown>(key);
    } catch {
      return undefined;
    }
  }

  private async evict(request: FastifyRequest, options: HttpCacheEvictOptions): Promise<void> {
    const url = request.originalUrl;
    await this.cache.del(this.keyFor(request, url));

    if (options.collection === false) return;

    const collectionUrl = this.parentUrl(url);
    if (collectionUrl !== url) {
      await this.cache.del(this.keyFor(request, collectionUrl));
    }
  }

  /** `/api/v1/purchase-orders/7?x=1` → `/api/v1/purchase-orders`. */
  private parentUrl(url: string): string {
    const path = url.split('?')[0] ?? url;
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return url;
    segments.pop();
    return `/${segments.join('/')}`;
  }

  private keyFor(request: FastifyRequest, url: string): string {
    return buildHttpCacheKey({
      tenantId: this.context.getTenantId(),
      companyId: this.context.getCompanyId(),
      method: 'GET',
      url,
    });
  }

  private metadata<T>(context: ExecutionContext, key: string): T | undefined {
    return (
      this.reflector.get<T | undefined>(key, context.getHandler()) ??
      this.reflector.get<T | undefined>(key, context.getClass())
    );
  }
}
