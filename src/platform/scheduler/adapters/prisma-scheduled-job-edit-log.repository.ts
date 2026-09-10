import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { randomUUID } from 'crypto';
import {
  InsertEditLogInput,
  ScheduledJobEditLogRepositoryPort,
} from '../ports/scheduled-job-edit-log-repository.port';

@Injectable()
export class PrismaScheduledJobEditLogRepository implements ScheduledJobEditLogRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async insert(input: InsertEditLogInput): Promise<void> {
    await this.txHost.tx.scheduledJobEditLog.create({
      data: {
        id: randomUUID(),
        scheduledJobId: input.scheduledJobId,
        editedBy: input.editedBy ?? null,
        changedFields: JSON.parse(JSON.stringify(input.changedFields)) as object,
      },
    });
  }
}
