import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import {
  CLS_REQUEST_CONTEXT_KEY,
  RequestContext,
  RequestContextData,
} from '../../shared-kernel/ports/context/request-context';
import { RequestContextPort } from '@shared-kernel/ports/context/request-context.port';

/**
 * CLS-backed request context. `nestjs-cls` is the only supported transport.
 */
@Injectable()
export class ClsRequestContextService implements RequestContextPort {
  constructor(private readonly cls: ClsService) {}

  public isAvailable(): boolean {
    return this.cls.isActive();
  }

  public get(): RequestContext | null {
    if (!this.cls.isActive()) return null;
    return this.cls.get<RequestContext>(CLS_REQUEST_CONTEXT_KEY) ?? null;
  }

  public require(): RequestContext {
    const context = this.get();
    if (!context) {
      throw new Error(
        'Request context is not available. Is the RequestContextInterceptor mounted?',
      );
    }
    return context;
  }

  public set(context: Partial<RequestContextData>): void {
    const existing = this.get();
    if (existing) {
      this.cls.set(CLS_REQUEST_CONTEXT_KEY, existing.with(context));
      return;
    }
    this.cls.set(CLS_REQUEST_CONTEXT_KEY, RequestContext.create({ ...emptyContext(), ...context }));
  }

  public getRequestId(): string | undefined {
    return this.get()?.requestId;
  }

  public getCorrelationId(): string | undefined {
    return this.get()?.correlationId;
  }

  public getTenantId(): string | undefined {
    return this.get()?.tenantId;
  }

  public getOrganizationId(): string | undefined {
    return this.get()?.organizationId;
  }

  public getUserId(): string | undefined {
    return this.get()?.userId;
  }
}

function emptyContext(): RequestContextData {
  return {
    requestId: '',
    correlationId: '',
    roles: [],
    locale: 'en',
  };
}
