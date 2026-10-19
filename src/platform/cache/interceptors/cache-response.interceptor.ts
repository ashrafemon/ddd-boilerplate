import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CachePort } from '../ports/cache.port';
import { Request, Response } from 'express';

@Injectable()
export class CacheResponseInterceptor implements NestInterceptor {
  constructor(private readonly cache: CachePort) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method !== 'GET') {
      return next.handle();
    }
    const cacheKey = this.cache.buildKey({ namespace: 'http', resource: req.originalUrl });
    const cached = await this.cache.get(cacheKey);
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
}
