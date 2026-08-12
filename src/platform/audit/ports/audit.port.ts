export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  actorType?: string;
  actorId?: string;
  tenantId?: string;
  organizationId?: string;
}

/**
 * Governance/audit port. Business modules record what happened, when, by whom
 * and what changed. The platform persists the trail through infrastructure.
 */
export interface AuditPort {
  record(entry: AuditEntry): Promise<void>;
}

export const AUDIT = Symbol('AUDIT');
