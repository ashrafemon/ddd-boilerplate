import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaJson } from '@platform/platform-common/persistence/prisma-json';
import {
  SagaDefinitionBody,
  SagaDefinitionRecord,
  SagaDefinitionStatus,
} from '../../types/saga.types';
import { SagaDefinitionRepositoryPort } from '../ports/saga-definition.repository.port';

interface DefinitionRow {
  id: string;
  ownerModule: string | null;
  sagaKey: string;
  version: number;
  eventName: string;
  eventVersion: number;
  status: string;
  definition: unknown;
  createdAt: Date;
}

/** PostgreSQL adapter for `saga_definitions` (workbook column set). */
@Injectable()
export class PrismaSagaDefinitionRepository implements SagaDefinitionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async findActiveByEvent(
    eventName: string,
    eventVersion: number,
  ): Promise<SagaDefinitionRecord | null> {
    const row = await this.txHost.tx.sagaDefinition.findFirst({
      where: { eventName, eventVersion, status: SagaDefinitionStatus.ACTIVE },
      orderBy: { version: 'desc' },
    });
    return row ? this.toRecord(row) : null;
  }

  async findActiveByKey(sagaKey: string): Promise<SagaDefinitionRecord | null> {
    const row = await this.txHost.tx.sagaDefinition.findFirst({
      where: { sagaKey, status: SagaDefinitionStatus.ACTIVE },
    });
    return row ? this.toRecord(row) : null;
  }

  async listActive(): Promise<SagaDefinitionRecord[]> {
    const rows = await this.txHost.tx.sagaDefinition.findMany({
      where: { status: SagaDefinitionStatus.ACTIVE },
      orderBy: { sagaKey: 'asc' },
    });
    return rows.map(row => this.toRecord(row));
  }

  async listAll(filter?: {
    status?: SagaDefinitionStatus;
    sagaKey?: string;
  }): Promise<SagaDefinitionRecord[]> {
    const rows = await this.txHost.tx.sagaDefinition.findMany({
      where: {
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.sagaKey ? { sagaKey: filter.sagaKey } : {}),
      },
      orderBy: [{ sagaKey: 'asc' }, { version: 'desc' }],
    });
    return rows.map(row => this.toRecord(row));
  }

  async findById(id: string): Promise<SagaDefinitionRecord | null> {
    const row = await this.txHost.tx.sagaDefinition.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByKeyVersion(sagaKey: string, version: number): Promise<SagaDefinitionRecord | null> {
    const row = await this.txHost.tx.sagaDefinition.findUnique({
      where: { sagaKey_version: { sagaKey, version } },
    });
    return row ? this.toRecord(row) : null;
  }

  async markStatus(id: string, status: SagaDefinitionStatus): Promise<void> {
    await this.txHost.tx.sagaDefinition.updateMany({ where: { id }, data: { status } });
  }

  async create(input: {
    sagaKey: string;
    ownerModule?: string | null;
    status: SagaDefinitionStatus;
    definition: SagaDefinitionBody;
    createdBy?: string;
  }): Promise<SagaDefinitionRecord> {
    const row = await this.txHost.tx.sagaDefinition.create({
      data: {
        sagaKey: input.sagaKey,
        ownerModule: input.ownerModule ?? null,
        version: input.definition.version,
        eventName: input.definition.start.event.name,
        eventVersion: input.definition.start.event.version,
        status: input.status,
        definition: PrismaJson.toInput(input.definition) as object,
        createdBy: input.createdBy,
      },
    });
    return this.toRecord(row);
  }

  private toRecord(row: DefinitionRow): SagaDefinitionRecord {
    return {
      id: row.id,
      ownerModule: row.ownerModule,
      sagaKey: row.sagaKey,
      version: row.version,
      eventName: row.eventName,
      eventVersion: row.eventVersion,
      status: row.status as SagaDefinitionStatus,
      definition: row.definition as SagaDefinitionBody,
      createdAt: row.createdAt,
    };
  }
}
