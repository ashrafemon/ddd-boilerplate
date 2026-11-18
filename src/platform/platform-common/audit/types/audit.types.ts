/** One recorded change, as the caller describes it. */
export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  actorType?: string;
  actorId?: string;
  tenantId?: string;
  companyId?: string;
}

/** Fully resolved row: context defaults already applied. */
export interface AuditLogRecord {
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  actorType: string;
  actorId?: string;
  tenantId?: string;
  companyId?: string;
  requestId?: string;
  correlationId?: string;
}

const SENSITIVE_KEY = /(password|secret|token|authorization|pin|otp)/i;
const MAX_FIELD_LENGTH = 4_000;

/**
 * Redaction and truncation for the audit trail.
 *
 * Audit rows are long-lived and widely readable, so a change set is never
 * stored verbatim: credential-shaped field names are replaced wholesale, and
 * oversized values are truncated so one giant payload cannot bloat the table.
 */
export function redactChanges(
  changes?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!changes) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : truncate(value);
  }
  return out;
}

function truncate(value: unknown): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    // Non-strings are stored as JSON; keep the structured value when it fits.
    return value;
  }
  return value.length > MAX_FIELD_LENGTH
    ? `${value.slice(0, MAX_FIELD_LENGTH)}…[truncated]`
    : value;
}
