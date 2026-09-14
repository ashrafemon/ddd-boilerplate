import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '../../../generated/client';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import {
  CompleteExecutionInput,
  RecurringExecutionRepositoryPort,
} from '../ports/recurring-execution-repository.port';
import { ClaimExecutionInput, RecurringExecutionRecord } from '../recurring-template.types';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * `claim()` is the entire idempotency mechanism from doc §4.2/§10: an INSERT
 * attempt on the unique (recurringTemplateId, triggerKey) pair. A P2002
 * violation means something already claimed this occurrence — return null
 * and let the caller exit cleanly. Never a read-then-write check.
 */
@Injectable()
export class PrismaRecurringExecutionRepository implements RecurringExecutionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async claim(input: ClaimExecutionInput): Promise<RecurringExecutionRecord | null> {
    try {
      const row = await this.txHost.tx.recurringExecution.create({
        data: {
          tenantId: input.tenantId,
          recurringTemplateId: input.recurringTemplateId,
          scheduleJobId: input.scheduleJobId,
          runDate: input.runDate,
          sourceEventId: input.sourceEventId,
          triggerKey: input.triggerKey,
          generatedDocumentType: input.generatedDocumentType,
          status: 'IN_PROGRESS',
        },
      });
      return RecurringExecutionMapper.toRecord(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        return null;
      }
      throw err;
    }
  }

  async findById(id: string): Promise<RecurringExecutionRecord | null> {
    const row = await this.txHost.tx.recurringExecution.findUnique({ where: { id } });
    return row ? RecurringExecutionMapper.toRecord(row) : null;
  }

  async findByTemplateAndTrigger(
    recurringTemplateId: string,
    triggerKey: string,
  ): Promise<RecurringExecutionRecord | null> {
    const row = await this.txHost.tx.recurringExecution.findUnique({
      where: {
        recurringTemplateId_triggerKey: { recurringTemplateId, triggerKey },
      },
    });
    return row ? RecurringExecutionMapper.toRecord(row) : null;
  }

  async failStale(createdAtOlderThan: Date, limit: number): Promise<number> {
    const stale = await this.txHost.tx.recurringExecution.findMany({
      where: { status: 'IN_PROGRESS', createdAt: { lt: createdAtOlderThan } },
      select: { id: true },
      take: limit,
    });
    if (stale.length === 0) {
      return 0;
    }
    const result = await this.txHost.tx.recurringExecution.updateMany({
      where: { id: { in: stale.map(row => row.id) }, status: 'IN_PROGRESS' },
      data: { status: 'FAILED', errorMessage: 'Consumer did not complete execution in time' },
    });
    return result.count;
  }

  async complete(id: string, input: CompleteExecutionInput): Promise<void> {
    await this.txHost.tx.recurringExecution.updateMany({
      where: { id, status: 'IN_PROGRESS' },
      data: {
        status: 'SUCCESS',
        generatedDocumentId: input.generatedDocumentId,
        generatedSnapshot: PrismaJson.toInput(input.generatedSnapshot),
        conditionEvaluation: PrismaJson.toInput(input.conditionEvaluation),
        executionTimeMs: input.executionTimeMs,
      },
    });
  }

  async fail(id: string, errorMessage: string): Promise<void> {
    await this.txHost.tx.recurringExecution.updateMany({
      where: { id, status: 'IN_PROGRESS' },
      data: { status: 'FAILED', errorMessage },
    });
  }

  async skip(
    id: string,
    skipReason: string,
    conditionEvaluation?: Record<string, unknown>,
  ): Promise<void> {
    await this.txHost.tx.recurringExecution.updateMany({
      where: { id, status: 'IN_PROGRESS' },
      data: {
        status: 'SKIPPED',
        skipReason,
        conditionEvaluation: PrismaJson.toInput(conditionEvaluation),
      },
    });
  }
}

interface ExecutionRow {
  id: string;
  recurringTemplateId: string;
  scheduleJobId: string | null;
  runDate: Date | null;
  sourceEventId: string | null;
  triggerKey: string;
  generatedDocumentType: string;
  generatedDocumentId: string | null;
  generatedSnapshot: Prisma.JsonValue | null;
  conditionEvaluation: Prisma.JsonValue | null;
  status: string;
  skipReason: string | null;
  errorMessage: string | null;
}

export class RecurringExecutionMapper {
  static toRecord(row: ExecutionRow): RecurringExecutionRecord {
    return {
      id: row.id,
      recurringTemplateId: row.recurringTemplateId,
      scheduleJobId: row.scheduleJobId,
      runDate: row.runDate,
      sourceEventId: row.sourceEventId,
      triggerKey: row.triggerKey,
      generatedDocumentType: row.generatedDocumentType,
      generatedDocumentId: row.generatedDocumentId,
      generatedSnapshot: PrismaJson.asRecord(row.generatedSnapshot),
      conditionEvaluation: PrismaJson.asRecord(row.conditionEvaluation),
      status: row.status as RecurringExecutionRecord['status'],
      skipReason: row.skipReason,
      errorMessage: row.errorMessage,
    };
  }
}
