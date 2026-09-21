import {
  BadRequestException,
  ConflictException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { IdempotencyPort } from '../ports/idempotency.port';
import { IDEMPOTENCY_HEADER, IDEMPOTENT_KEY } from './idempotent.decorator';

/**
 * Enforces `@Idempotent()` routes. Global APP_INTERCEPTOR installed by
 * IdempotencyModule but a no-op unless the route carries the decorator, so
 * non-idempotent endpoints pay nothing. The stored snapshot is whatever the
 * handler pipeline returned (post ResponseInterceptor wrapping on this
 * instance), which keeps replays byte-identical to the original response.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly idempotency: IdempotencyPort,
    private readonly requestContext: RequestContextPort,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const marked = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!marked) {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
    const rawKey = request.headers?.[IDEMPOTENCY_HEADER];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!key || !key.trim()) {
      throw new BadRequestException(`'Idempotency-Key' header is required for this operation`);
    }

    const reservation = await this.idempotency.reserve({
      tenantId: this.requestContext.getTenantId() ?? '',
      organizationId: this.requestContext.getOrganizationId() ?? '',
      scope: `${context.getClass().name}.${context.getHandler().name}`,
      key: key.trim().slice(0, 255),
      ttlMs: this.config.getIdempotency().ttlMs,
    });

    if (reservation.status === 'REPLAY') {
      return of(reservation.result);
    }
    if (reservation.status === 'IN_PROGRESS') {
      throw new ConflictException(
        `An operation with Idempotency-Key '${key.trim()}' is still in progress; retry later`,
      );
    }
    if (reservation.status === 'SUSPENDED') {
      throw new ConflictException(
        `An operation with Idempotency-Key '${key.trim()}' requires reconciliation`,
      );
    }
    if (reservation.status === 'KEY_REUSED') {
      throw new ConflictException(
        `Idempotency-Key '${key.trim()}' is associated with another request`,
      );
    }

    return next.handle().pipe(
      switchMap(async (response: unknown) => {
        await this.idempotency
          .complete({ reservation: reservation.reservation, result: response })
          .catch(() => undefined);
        return response;
      }),
      catchError(async (err: unknown) => {
        await this.idempotency
          .fail({ reservation: reservation.reservation })
          .catch(() => undefined);
        throw err;
      }),
    );
  }
}
