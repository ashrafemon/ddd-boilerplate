import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '@prisma/client';
import {
  RecurringTemplateRepositoryPort,
  RecurringTemplateUpdate,
} from '../ports/recurring-template-repository.port';
import { CreateRecurringTemplateInput, RecurringTemplateRecord } from '../recurring-template.types';
import { DuplicateTemplateNoError } from '../recurring.errors';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaRecurringTemplateRepository implements RecurringTemplateRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async create(input: CreateRecurringTemplateInput): Promise<RecurringTemplateRecord> {
    try {
      const row = await this.createRow(input);
      return toRecord(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new DuplicateTemplateNoError(input.templateNo);
      }
      throw err;
    }
  }

  private createRow(input: CreateRecurringTemplateInput) {
    return this.txHost.tx.recurringTemplate.create({
      data: {
        tenantId: input.tenantId,
        templateNo: input.templateNo,
        name: input.name,
        targetEntityType: input.targetEntityType,
        targetEntityId: input.targetEntityId,
        originDocumentType: input.originDocumentType,
        originDocumentId: input.originDocumentId,
        partyId: input.partyId,
        partyType: input.partyType,
        currency: input.currency,
        triggerType: input.triggerType,
        eventName: input.eventName,
        frequency: input.frequency,
        interval: input.interval,
        startDate: input.startDate,
        endDate: input.endDate,
        nextRunDate: input.startDate,
        timeZone: input.timeZone ?? 'UTC',
        autoPost: input.autoPost ?? false,
        autoEmail: input.autoEmail ?? false,
        autoApprove: input.autoApprove ?? false,
        headerOverrides: toPrismaJson(input.headerOverrides),
        generationCondition: toPrismaJson(input.generationCondition),
        lines: toPrismaJson(input.lines) as object,
        createdBy: input.createdBy,
      },
    });
  }

  async findById(id: string): Promise<RecurringTemplateRecord | null> {
    const row = await this.txHost.tx.recurringTemplate.findFirst({
      where: { id, isDeleted: false },
    });
    return row ? toRecord(row) : null;
  }

  async update(id: string, patch: RecurringTemplateUpdate): Promise<RecurringTemplateRecord> {
    const row = await this.txHost.tx.recurringTemplate.update({
      where: { id },
      data: {
        status: patch.status,
        nextRunDate: patch.nextRunDate,
        lastRunDate: patch.lastRunDate,
        modifiedBy: patch.modifiedBy,
        modifiedAt: new Date(),
      },
    });
    return toRecord(row);
  }

  async list(filter: {
    tenantId?: string;
    status?: RecurringTemplateRecord['status'];
  }): Promise<RecurringTemplateRecord[]> {
    const rows = await this.txHost.tx.recurringTemplate.findMany({
      where: { tenantId: filter.tenantId, status: filter.status, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  async findActiveByEventName(
    eventName: string,
    tenantId?: string,
  ): Promise<RecurringTemplateRecord[]> {
    const rows = await this.txHost.tx.recurringTemplate.findMany({
      where: { eventName, status: 'ACTIVE', isDeleted: false, tenantId },
    });
    return rows.map(toRecord);
  }
}

interface TemplateRow {
  id: string;
  tenantId: string | null;
  templateNo: string;
  name: string;
  status: string;
  targetEntityType: string;
  targetEntityId: string | null;
  originDocumentType: string | null;
  originDocumentId: string | null;
  partyId: string | null;
  partyType: string | null;
  currency: string;
  triggerType: string;
  eventName: string | null;
  frequency: string | null;
  interval: number | null;
  startDate: Date | null;
  endDate: Date | null;
  nextRunDate: Date | null;
  lastRunDate: Date | null;
  timeZone: string;
  autoPost: boolean;
  autoEmail: boolean;
  autoApprove: boolean;
  headerOverrides: unknown;
  generationCondition: unknown;
  lines: unknown;
}

function toRecord(row: TemplateRow): RecurringTemplateRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    templateNo: row.templateNo,
    name: row.name,
    status: row.status as RecurringTemplateRecord['status'],
    targetEntityType: row.targetEntityType,
    targetEntityId: row.targetEntityId,
    originDocumentType: row.originDocumentType,
    originDocumentId: row.originDocumentId,
    partyId: row.partyId,
    partyType: row.partyType as RecurringTemplateRecord['partyType'],
    currency: row.currency,
    triggerType: row.triggerType as RecurringTemplateRecord['triggerType'],
    eventName: row.eventName,
    frequency: row.frequency as RecurringTemplateRecord['frequency'],
    interval: row.interval,
    startDate: row.startDate,
    endDate: row.endDate,
    nextRunDate: row.nextRunDate,
    lastRunDate: row.lastRunDate,
    timeZone: row.timeZone,
    autoPost: row.autoPost,
    autoEmail: row.autoEmail,
    autoApprove: row.autoApprove,
    headerOverrides: (row.headerOverrides as Record<string, unknown> | null) ?? null,
    generationCondition: (row.generationCondition as Record<string, unknown> | null) ?? null,
    lines: (row.lines as unknown[]) ?? [],
  };
}

function toPrismaJson(value: unknown): object | undefined {
  if (value === undefined || value === null) return undefined;
  // JSON round-trip produces a plain JSON value that satisfies Prisma's
  // InputJsonValue, which the generated @ts-nocheck types don't expose to tsc.
  return JSON.parse(JSON.stringify(value)) as object;
}
