import { RequestContext, RequestContextData } from './request-context';

/**
 * Port exposing the current request context.
 *
 * The implementation stores the context in nestjs-cls, so every layer
 * (use case, repository, outbox, message consumer) can read tenant,
 * organization and correlation information without threading it through
 * every method signature.
 */
export abstract class RequestContextPort {
  public abstract isAvailable(): boolean;

  public abstract get(): RequestContext | null;

  public abstract require(): RequestContext;

  public abstract set(context: Partial<RequestContextData>): void;

  public abstract getRequestId(): string | undefined;

  public abstract getCorrelationId(): string | undefined;

  public abstract getTenantId(): string | undefined;

  public abstract getOrganizationId(): string | undefined;

  public abstract getUserId(): string | undefined;
}
