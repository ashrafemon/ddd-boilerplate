import { ConflictException, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { JournalEntry } from '@business/finance/domain/aggregates/journal-entry.aggregate';
import { JournalEntryRepository } from '@business/finance/domain/repositories/finance.repository';
import { PrismaFinanceMapper } from './prisma-finance.mapper';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';

@Injectable()
export class PrismaJournalEntryRepository extends JournalEntryRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  private sharedScope(): Record<string, unknown> {
    const tid = this.requestContext.getTenantId();
    return tid ? { tenantId: tid } : {};
  }

  async findById(id: string): Promise<JournalEntry | null> {
    const row = await this.txHost.tx.journalEntry.findFirst({
      where: { id, ...this.sharedScope() } as any,
    });
    return row ? PrismaFinanceMapper.toJournalEntryDomain(row) : null;
  }

  async findByEntryNo(entryNo: string): Promise<JournalEntry | null> {
    const row = await this.txHost.tx.journalEntry.findFirst({
      where: { entryNo, ...this.sharedScope() } as any,
    });
    return row ? PrismaFinanceMapper.toJournalEntryDomain(row) : null;
  }

  async save(entry: JournalEntry): Promise<JournalEntry> {
    const companyId = this.requestContext.getCompanyId();
    if (!companyId) {
      throw new Error('Company not found in request context');
    }
    await this.txHost.tx.journalEntry.create({
      data: {
        ...PrismaFinanceMapper.toJournalEntryRow(entry),
        tenantId: this.requestContext.getTenantId(),
        companyId,
      } as any,
    });
    return entry;
  }

  async update(entry: JournalEntry): Promise<JournalEntry> {
    const res = await this.txHost.tx.journalEntry.updateMany({
      where: {
        entryNo: entry.entryNo,
        ...this.sharedScope(),
      } as never,
      data: { ...PrismaFinanceMapper.toJournalEntryRow(entry), version: { increment: 1 } } as any,
    });
    if (res.count === 0) {
      throw new ConflictException('Journal entry was modified concurrently');
    }
    return entry;
  }
}
