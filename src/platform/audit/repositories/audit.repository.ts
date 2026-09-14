import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { AuditEntry, AuditPort } from '../ports/audit.port';

/**
 * Prisma-backed audit trail. All DB access goes through the TransactionHost
 * so audit rows commit atomically with the business change. Request/correlation
 * ids and tenant/organization scope are filled from `RequestContextPort` when
 * the caller does not provide them.
 */
@Injectable()
export class PrismaAuditRepository implements AuditPort {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly requestContext: RequestContextPort,
  ) {}

  public async record(entry: AuditEntry): Promise<void> {
    const context = this.requestContext.get();
    await this.txHost.tx.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: (this.redact(entry.changes) as object) ?? undefined,
        actorId: entry.actorId ?? context?.userId,
        actorType: entry.actorType ?? (context?.userId ? 'user' : 'system'),
        tenantId: entry.tenantId ?? this.requestContext.getTenantId(),
        organizationId: entry.organizationId ?? this.requestContext.getOrganizationId(),
        requestId: this.requestContext.getRequestId(),
        correlationId: this.requestContext.getCorrelationId(),
      },
    });
  }

  private redact(changes?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!changes) {
      return undefined;
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
      out[key] = SENSITIVE_KEYS.test(key) ? '[redacted]' : truncate(value);
    }
    return out;
  }
}

const SENSITIVE_KEYS = /(password|secret|token|authorization|pin|otp)/i;
const MAX_FIELD_JSON = 4_000;

function truncate(value: unknown): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  const text = typeof value === 'string' ? value : safeStringify(value);
  return text.length > MAX_FIELD_JSON ? `${text.slice(0, MAX_FIELD_JSON)}…[truncated]` : value;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
