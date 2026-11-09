import { StockMovement } from '@business/inventory/domain/aggregates/stock-movement.aggregate';
import { StockBalance } from '@business/inventory/domain/aggregates/stock-movement.aggregate';
import { StockMovementCommandRepository } from '@business/inventory/domain/repositories/stock-movement-command.repository';
import { StockBalanceRepository } from '@business/inventory/domain/repositories/stock-movement-command.repository';
import { PrismaStockMovementMapper } from './prisma-stock-movement.mapper';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { TenantScope } from '@common/application/utils/tenant-scope';

@Injectable()
export class PrismaStockMovementCommandRepository extends StockMovementCommandRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  private sharedScope(): { OR: Array<{ tenantId: string | null }> } {
    return TenantScope.where<{ OR: Array<{ tenantId: string | null }> }>(
      this.requestContext.getTenantId(),
      { includeUnscoped: true },
    );
  }

  async findById(id: string): Promise<StockMovement | null> {
    const row = await this.txHost.tx.stockMovement.findFirst({
      where: { id, ...this.sharedScope() } as never,
    });
    return row ? PrismaStockMovementMapper.toDomain(row) : null;
  }

  async findByGrnLineId(grnLineId: string): Promise<StockMovement | null> {
    const row = await this.txHost.tx.stockMovement.findFirst({
      where: { grnLineId, ...this.sharedScope() } as never,
    });
    return row ? PrismaStockMovementMapper.toDomain(row) : null;
  }

  async save(movement: StockMovement): Promise<StockMovement> {
    const companyId = this.requestContext.getCompanyId();
    if (!companyId) {
      throw new Error('Company not found in request context');
    }
    await this.txHost.tx.stockMovement.create({
      data: {
        ...PrismaStockMovementMapper.toRow(movement),
        tenantId: this.requestContext.getTenantId(),
        companyId,
      } as never,
    });
    return movement;
  }
}

@Injectable()
export class PrismaStockBalanceRepository extends StockBalanceRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  private sharedScope(): { OR: Array<{ tenantId: string | null }> } {
    return TenantScope.where<{ OR: Array<{ tenantId: string | null }> }>(
      this.requestContext.getTenantId(),
      { includeUnscoped: true },
    );
  }

  async findByProduct(
    productId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<StockBalance | null> {
    const row = await this.txHost.tx.stockBalance.findFirst({
      where: {
        productId,
        ...(companyId ? { companyId } : {}),
        ...(tenantId ? { tenantId } : {}),
        ...this.sharedScope(),
      } as never,
    });
    return row ? PrismaStockMovementMapper.toBalanceDomain(row) : null;
  }

  async save(balance: StockBalance): Promise<StockBalance> {
    const companyId = this.requestContext.getCompanyId();
    if (!companyId) {
      throw new Error('Company not found in request context');
    }
    await this.txHost.tx.stockBalance.upsert({
      where: {
        productId_companyId_tenantId: {
          productId: balance.productId,
          companyId,
          tenantId: balance.tenantId ?? '',
        },
      },
      update: {
        quantity: balance.quantity,
        updatedAt: balance.updatedAt,
      },
      create: {
        id: balance.id,
        productId: balance.productId,
        companyId,
        tenantId: balance.tenantId ?? '',
        quantity: balance.quantity,
        updatedAt: balance.updatedAt,
      } as never,
    });
    return balance;
  }
}
