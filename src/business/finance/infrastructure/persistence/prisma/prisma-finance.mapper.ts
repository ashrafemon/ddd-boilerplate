import { JournalEntry } from '@business/finance/domain/aggregates/journal-entry.aggregate';
import { JournalEntryId } from '@business/finance/domain/value-objects';
import { JournalEntryStatus } from '@business/finance/domain/types/finance.enum';
import { JournalEntryProps } from '@business/finance/domain/types/finance.types';
import { JournalEntryQueryRecord } from '@business/finance/domain/types/finance.types';

export class PrismaFinanceMapper {
  static toJournalEntryDomain(row: any): JournalEntry {
    return JournalEntry.instantiate(
      JournalEntryId.fromString(row.id),
      {
        id: row.id,
        entryNo: row.entryNo,
        reference: row.reference,
        postingDate: row.postingDate,
        status: row.status as JournalEntryStatus,
        companyId: row.companyId,
        tenantId: row.tenantId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        version: row.version,
      } satisfies JournalEntryProps,
      row.version,
    );
  }

  static toJournalEntryRow(entry: JournalEntry): {
    id: string;
    entryNo: string;
    reference: string | null;
    postingDate: Date;
    status: string;
    version: number;
  } {
    return {
      id: entry.entryNo,
      entryNo: entry.entryNo,
      reference: entry.reference,
      postingDate: entry.postingDate,
      status: entry.status,
      version: (entry as any).version,
    };
  }

  static toJournalEntryRecord(row: any): JournalEntryQueryRecord {
    const r = row as {
      id: string;
      entryNo: string;
      reference: string | null;
      postingDate: Date;
      status: string;
      companyId: string;
      tenantId: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: r.id,
      entryNo: r.entryNo,
      reference: r.reference,
      postingDate: r.postingDate,
      status: r.status,
      companyId: r.companyId,
      tenantId: r.tenantId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
