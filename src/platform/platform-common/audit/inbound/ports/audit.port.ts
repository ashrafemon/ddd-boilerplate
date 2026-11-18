import { AuditEntry } from '../../types/audit.types';

// Re-exported so callers depend on the port, not on the module's internals.
export type { AuditEntry };

/**
 * Inbound port: append to the audit trail.
 *
 * Callers describe *what changed*; actor, tenant, request and truncation rules
 * are resolved by the use case so every module produces the same shaped row.
 */
export abstract class AuditPort {
  abstract record(entry: AuditEntry): Promise<void>;
}
