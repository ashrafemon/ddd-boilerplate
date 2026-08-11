import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

export const DEFAULT_TIMEOUT_MS = 30_000;
export const TIMEOUT_MS_TOKEN = 'TIMEOUT_MS_TOKEN';

/**
 * Fails a request that takes longer than the configured timeout.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number;

  constructor(@Optional() @Inject(TIMEOUT_MS_TOKEN) timeoutMs?: number) {
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  public intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          throw new RequestTimeoutException('Request timed out');
        }
        throw error;
      }),
    );
  }
}
