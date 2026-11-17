/**
 * Thrown by infrastructure clients (prisma, redis, kafka, s3, …) when a
 * backing service fails to initialize or is unreachable.
 *
 * Standalone — the infrastructure layer must not depend on `@common` or
 * `@platform`, so this class extends Error directly (same shape the shared
 * DomainException used to provide: message + code + details).
 */
export class InfrastructureException extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'InfrastructureException';
    this.code = 'INFRASTRUCTURE_ERROR';
    this.details = details;
  }
}
