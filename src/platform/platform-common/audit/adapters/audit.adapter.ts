import { Injectable } from '@nestjs/common';
import { RecordAuditEntryUseCase } from '../use-cases/record-audit-entry.usecase';
import { AuditEntry } from '../types/audit.types';
import { AuditPort } from '../ports/audit.port';

/** Inbound adapter implementing `AuditPort`; all rules live in the use case. */
@Injectable()
export class AuditAdapter implements AuditPort {
  constructor(private readonly recordAuditEntry: RecordAuditEntryUseCase) {}

  record(entry: AuditEntry): Promise<void> {
    return this.recordAuditEntry.execute(entry);
  }
}
