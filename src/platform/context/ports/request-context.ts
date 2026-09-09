/**
 * Key under which the request context is stored in the CLS store.
 */
export const CLS_REQUEST_CONTEXT_KEY = 'requestContext';

/**
 * All request-scoped values that propagate through CLS and should remain
 * available across HTTP handlers, use cases, repositories, outbox records and
 * message consumers.
 */
export interface RequestContextData {
  requestId: string;
  correlationId: string;
  tenantId?: string;
  organizationId?: string;
  userId?: string;
  roles: string[];
  locale: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Immutable snapshot of the current request context.
 */
export class RequestContext {
  public readonly requestId: string;
  public readonly correlationId: string;
  public readonly tenantId?: string;
  public readonly organizationId?: string;
  public readonly userId?: string;
  public readonly roles: string[];
  public readonly locale: string;
  public readonly ip?: string;
  public readonly userAgent?: string;

  private constructor(data: RequestContextData) {
    this.requestId = data.requestId;
    this.correlationId = data.correlationId;
    this.tenantId = data.tenantId;
    this.organizationId = data.organizationId;
    this.userId = data.userId;
    this.roles = data.roles;
    this.locale = data.locale;
    this.ip = data.ip;
    this.userAgent = data.userAgent;
  }

  public static create(data: RequestContextData): RequestContext {
    return new RequestContext(data);
  }

  public with(patch: Partial<RequestContextData>): RequestContext {
    return new RequestContext({ ...this.toData(), ...patch });
  }

  public toData(): RequestContextData {
    return {
      requestId: this.requestId,
      correlationId: this.correlationId,
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      userId: this.userId,
      roles: this.roles,
      locale: this.locale,
      ip: this.ip,
      userAgent: this.userAgent,
    };
  }
}
