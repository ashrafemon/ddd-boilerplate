import { JsonObject, JsonValue } from '@shared-kernel/types/json-value.type';
import { ConflictException, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '../../../generated/client';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import {
  RecurringTemplateRepositoryPort,
  RecurringTemplateUpdate,
} from '../ports/recurring-template-repository.port';
import { CreateRecurringTemplateInput, RecurringTemplateRecord } from '../recurring-template.types';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaRecurringTemplateRepository implements RecurringTemplateRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async create(input: CreateRecurringTemplateInput): Promise<RecurringTemplateRecord> {
    try {
      const row = await this.createRow(input);
      return RecurringTemplateMapper.toRecord(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException(
          `RecurringTemplate.templateNo '${input.templateNo}' already exists`,
        );
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
        headerOverrides: PrismaJson.toInput(input.headerOverrides),
        generationCondition: PrismaJson.toInput(input.generationCondition),
        lines: PrismaJson.toInput(input.lines) as object,
        createdBy: input.createdBy,
      },
    });
  }

  async findById(id: string): Promise<RecurringTemplateRecord | null> {
    const row = await this.txHost.tx.recurringTemplate.findFirst({
      where: { id, isDeleted: false },
    });
    return row ? RecurringTemplateMapper.toRecord(row) : null;
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
    return RecurringTemplateMapper.toRecord(row);
  }

  async list(filter: {
    tenantId?: string;
    status?: RecurringTemplateRecord['status'];
    limit?: number;
    offset?: number;
  }): Promise<RecurringTemplateRecord[]> {
    const rows = await this.txHost.tx.recurringTemplate.findMany({
      where: { tenantId: filter.tenantId, status: filter.status, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 50,
      skip: filter.offset ?? 0,
    });
    return rows.map(row => RecurringTemplateMapper.toRecord(row));
  }

  async findActiveByEventName(
    eventName: string,
    tenantId?: string,
  ): Promise<RecurringTemplateRecord[]> {
    const rows = await this.txHost.tx.recurringTemplate.findMany({
      where: { eventName, status: 'ACTIVE', isDeleted: false, tenantId },
    });
    return rows.map(row => RecurringTemplateMapper.toRecord(row));
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
  headerOverrides: Prisma.JsonValue | null;
  generationCondition: Prisma.JsonValue | null;
  lines: Prisma.JsonValue | null;
}

export class RecurringTemplateMapper {
  static toRecord(row: TemplateRow): RecurringTemplateRecord {
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
      headerOverrides: PrismaJson.as<JsonObject>(row.headerOverrides),
      generationCondition: PrismaJson.as<JsonObject>(row.generationCondition),
      lines: PrismaJson.as<JsonValue[]>(row.lines) ?? [],
    };
  }
}
