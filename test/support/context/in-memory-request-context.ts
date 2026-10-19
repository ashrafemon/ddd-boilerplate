import { RequestContext, RequestContextData } from '@platform/context/ports/request-context';
import { RequestContextPort } from '@platform/context/ports/request-context.port';

/**
 * In-memory RequestContextPort fake for use-case unit tests (no CLS, no Nest
 * runtime). Seed it with the identity the scenario needs; `run()` merges the
 * patch over the current context like the CLS adapter does.
 */
export class InMemoryRequestContextService implements RequestContextPort {
  private context: RequestContext | null;

  constructor(data?: Partial<RequestContextData>) {
    this.context = data ? RequestContext.create({ ...emptyData(), ...data }) : null;
  }

  public isAvailable(): boolean {
    return this.context !== null;
  }

  public get(): RequestContext | null {
    return this.context;
  }

  public require(): RequestContext {
    const context = this.get();
    if (!context) {
      throw new Error('Request context is not available in this test scenario');
    }
    return context;
  }

  public set(context: Partial<RequestContextData>): void {
    this.context = this.context
      ? this.context.with(context)
      : RequestContext.create({ ...emptyData(), ...context });
  }

  public async run<T>(patch: Partial<RequestContextData>, fn: () => T | Promise<T>): Promise<T> {
    const previous = this.context;
    const base = previous ?? RequestContext.create({ ...emptyData() });
    this.context = base.with(patch);
    try {
      return await fn();
    } finally {
      this.context = previous;
    }
  }

  public getRequestId(): string | undefined {
    return this.context?.requestId;
  }

  public getCorrelationId(): string | undefined {
    return this.context?.correlationId;
  }

  public getTenantId(): string | undefined {
    return this.context?.tenantId;
  }

  public getOrganizationId(): string | undefined {
    return this.context?.organizationId;
  }

  public getUserId(): string | undefined {
    return this.context?.userId;
  }
}

function emptyData(): RequestContextData {
  return { requestId: 'test-request', correlationId: 'test-correlation', roles: [], locale: 'en' };
}
