import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import { JournalEntry } from '../../domain/aggregates/journal-entry.aggregate';
import { JournalEntryRepository } from '../../domain/repositories/finance.repository';
import { FinancePublisherPort } from '../publishes/publishers/finance.publisher-port';
import { CreateJournalEntryInput } from '../../domain/types/finance.types';

@Injectable()
export class PostJournalEntryUseCase {
  constructor(
    private readonly journalEntryRepository: JournalEntryRepository,
    private readonly integrationEvent: FinancePublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
    private readonly audit: AuditPort,
  ) {}

  @Transactional()
  async execute(input: CreateJournalEntryInput): Promise<string> {
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new NotFoundException('Company not found in request context');
    }

    await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: 'JournalEntry',
      action: 'post',
    });

    const actorId = ctx.userId ?? '';

    const je = JournalEntry.record({
      entryNo: input.entryNo,
      reference: input.reference ?? null,
      postingDate: input.postingDate,
      companyId,
      tenantId: ctx.tenantId ?? null,
    });

    await this.journalEntryRepository.save(je);

    await this.audit.record({
      action: 'finance.post-journal-entry',
      entityType: 'JournalEntry',
      entityId: je.id.toString(),
      actorId,
      tenantId: ctx.tenantId,
      companyId: this.requestContext.getCompanyId(),
      changes: { entryNo: je.entryNo, status: je.status },
    });

    for (const event of je.pullEvents()) {
      await this.integrationEvent.send(event, je.id.toString());
    }

    return je.id.toString();
  }
}
