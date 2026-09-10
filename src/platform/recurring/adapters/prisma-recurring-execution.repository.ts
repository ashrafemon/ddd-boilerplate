import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '../../../generated/client';
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
      return toRecord(row);
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
    return row ? toRecord(row) : null;
  }

  async complete(id: string, input: CompleteExecutionInput): Promise<void> {
    await this.txHost.tx.recurringExecution.update({
      where: { id },
      data: {
        status: 'SUCCESS',
        generatedDocumentId: input.generatedDocumentId,
        generatedSnapshot: toPrismaJson(input.generatedSnapshot),
        conditionEvaluation: toPrismaJson(input.conditionEvaluation),
        executionTimeMs: input.executionTimeMs,
      },
    });
  }

  async fail(id: string, errorMessage: string): Promise<void> {
    await this.txHost.tx.recurringExecution.update({
      where: { id },
      data: { status: 'FAILED', errorMessage },
    });
  }

  async skip(
    id: string,
    skipReason: string,
    conditionEvaluation?: Record<string, unknown>,
  ): Promise<void> {
    await this.txHost.tx.recurringExecution.update({
      where: { id },
      data: {
        status: 'SKIPPED',
        skipReason,
        conditionEvaluation: toPrismaJson(conditionEvaluation),
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
  generatedSnapshot: unknown;
  conditionEvaluation: unknown;
  status: string;
  skipReason: string | null;
  errorMessage: string | null;
}

function toRecord(row: ExecutionRow): RecurringExecutionRecord {
  return {
    id: row.id,
    recurringTemplateId: row.recurringTemplateId,
    scheduleJobId: row.scheduleJobId,
    runDate: row.runDate,
    sourceEventId: row.sourceEventId,
    triggerKey: row.triggerKey,
    generatedDocumentType: row.generatedDocumentType,
    generatedDocumentId: row.generatedDocumentId,
    generatedSnapshot: (row.generatedSnapshot as Record<string, unknown> | null) ?? null,
    conditionEvaluation: (row.conditionEvaluation as Record<string, unknown> | null) ?? null,
    status: row.status as RecurringExecutionRecord['status'],
    skipReason: row.skipReason,
    errorMessage: row.errorMessage,
  };
}

function toPrismaJson(value: unknown): object | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as object;
}
