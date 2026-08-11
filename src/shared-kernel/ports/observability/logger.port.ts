export interface LogFields {
  [key: string]: unknown;
}

/**
 * Technical logging abstraction. Business/application code logs through this
 * port; the adapter decides whether output goes to console, pino, Loki, etc.
 *
 * Fields such as requestId/correlationId/tenantId are automatically attached
 * by the adapter when available in CLS.
 */
export abstract class LoggerPort {
  public abstract debug(message: string, fields?: LogFields): void;
  public abstract info(message: string, fields?: LogFields): void;
  public abstract warn(message: string, fields?: LogFields): void;
  public abstract error(message: string, fields?: LogFields): void;
  public abstract fatal(message: string, fields?: LogFields): void;
}
