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

export abstract class AuditPort {
  abstract record(entry: AuditEntry): Promise<void>;
}
