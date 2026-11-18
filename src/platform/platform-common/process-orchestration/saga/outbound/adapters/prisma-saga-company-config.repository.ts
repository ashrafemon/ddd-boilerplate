import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  SagaCompanyConfigRecord,
  SagaCompanyConfigStatus,
  SagaOverlay,
} from '../../types/saga.types';
import { SagaCompanyConfigRepositoryPort } from '../ports/saga-company-config.repository.port';

interface ConfigRow {
  id: string;
  tenantId: string;
  companyId: string;
  definitionId: string;
  sagaKey: string;
  baseVersion: number;
  overlay: unknown;
  status: string;
}

/** PostgreSQL adapter for `saga_company_configs` (one ACTIVE overlay per company). */
@Injectable()
export class PrismaSagaCompanyConfigRepository implements SagaCompanyConfigRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async findActive(
    tenantId: string,
    companyId: string,
    sagaKey: string,
  ): Promise<SagaCompanyConfigRecord | null> {
    const row = await this.txHost.tx.sagaCompanyConfig.findFirst({
      where: { tenantId, companyId, sagaKey, status: SagaCompanyConfigStatus.ACTIVE },
    });
    return row ? this.toRecord(row) : null;
  }

  async markInvalid(id: string): Promise<void> {
    await this.txHost.tx.sagaCompanyConfig.updateMany({
      where: { id, status: SagaCompanyConfigStatus.ACTIVE },
      data: { status: SagaCompanyConfigStatus.INVALID },
    });
  }

  private toRecord(row: ConfigRow): SagaCompanyConfigRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      definitionId: row.definitionId,
      sagaKey: row.sagaKey,
      baseVersion: row.baseVersion,
      overlay: row.overlay as SagaOverlay,
      status: row.status as SagaCompanyConfigStatus,
    };
  }
}
