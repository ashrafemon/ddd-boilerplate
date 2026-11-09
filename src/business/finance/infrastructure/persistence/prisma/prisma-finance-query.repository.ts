import { FinanceQuery } from '@business/finance/application/queries/finance.query';
import { PrismaReadPort } from '@platform/platform-common/context/ports/prisma-read.port';
import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@common/application/types/pagination';
import { JournalEntryQueryRecord } from '../../../domain/types/finance.types';
import { PrismaFinanceMapper } from './prisma-finance.mapper';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';

@Injectable()
export class PrismaFinanceQueryRepository extends FinanceQuery {
  constructor(
    private readonly prismaRead: PrismaReadPort,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  private sharedScope(): Record<string, unknown> {
    const tid = this.requestContext.getTenantId();
    return tid ? { tenantId: tid } : {};
  }

  async findJournalEntryById(id: string): Promise<JournalEntryQueryRecord | null> {
    const row = await this.prismaRead.journalEntry.findFirst({
      where: { id, ...this.sharedScope() } as any,
    });
    return row ? PrismaFinanceMapper.toJournalEntryRecord(row) : null;
  }

  async findJournalEntryByEntryNo(entryNo: string): Promise<JournalEntryQueryRecord | null> {
    const row = await this.prismaRead.journalEntry.findFirst({
      where: { entryNo, ...this.sharedScope() } as any,
    });
    return row ? PrismaFinanceMapper.toJournalEntryRecord(row) : null;
  }

  async findAllJournalEntries(query: PageQuery): Promise<PageResult<JournalEntryQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prismaRead.journalEntry.findMany({
        where: this.sharedScope() as any,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaRead.journalEntry.count({ where: this.sharedScope() as any }),
    ]);
    return {
      items: rows.map((row: never) => PrismaFinanceMapper.toJournalEntryRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  findAccountingEntriesByJournal(_journalEntryId: string): Promise<any[]> {
    return Promise.resolve([]);
  }

  findVendorBillById(_id: string): Promise<any> {
    return Promise.resolve(null);
  }

  findVendorBillByBillNo(_billNo: string): Promise<any> {
    return Promise.resolve(null);
  }

  findAllVendorBills(query: PageQuery): Promise<PageResult<any>> {
    return Promise.resolve({
      items: [],
      page: query.page,
      pageSize: query.pageSize,
      total: 0,
      totalPages: 0,
    });
  }

  findPaymentById(_id: string): Promise<any> {
    return Promise.resolve(null);
  }

  findPaymentByPaymentNo(_paymentNo: string): Promise<any> {
    return Promise.resolve(null);
  }

  findPayableOpenItemsByVendor(
    _vendorId: string,
    _companyId?: string,
    _tenantId?: string,
  ): Promise<any[]> {
    return Promise.resolve([]);
  }
}
