import { AuditLogRecord } from '../../types/audit.types';

/**
 * Outbound port: durable audit storage.
 *
 * `append` runs inside the caller's `@Transactional()` boundary, so a business
 * change and its audit row commit or roll back together.
 */
export abstract class AuditLogRepositoryPort {
  abstract append(record: AuditLogRecord): Promise<void>;
}
