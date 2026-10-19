import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { StockMovement } from '../../domain/aggregates/stock-movement.aggregate';
import { StockMovementId } from '../../domain/value-objects/stock-movement-id.vo';
import { StockMovementCommandRepository } from '../../domain/repositories/stock-movement-command.repository';
import { MovementType } from '../../domain/types/stock-movement.types';

@Injectable()
export class PrismaStockMovementCommandRepository extends StockMovementCommandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async save(movement: StockMovement): Promise<StockMovement> {
    await this.txHost.tx.stockMovement.create({
      data: {
        id: movement.id.toString(),
        grnLineId: movement.grnLineId,
        productId: movement.productId,
        quantity: movement.quantity,
        movementType: movement.movementType,
        sourceDocumentId: movement.sourceDocumentId,
        sourceDocumentType: movement.sourceDocumentType,
        companyId: movement.companyId,
        tenantId: movement.tenantId,
        actorId: movement.actorId ?? null,
        effectiveDate: movement.effectiveDate,
        reversalOfId: movement.reversalOfId ?? null,
      },
    });
    return movement;
  }

  async findByGrnLineAndType(
    grnLineId: string,
    movementType: MovementType,
  ): Promise<StockMovement | null> {
    const row = await this.txHost.tx.stockMovement.findUnique({
      where: { grnLineId_movementType: { grnLineId, movementType } },
    });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: {
    id: string;
    grnLineId: string;
    productId: string;
    quantity: number;
    movementType: string;
    sourceDocumentId: string;
    sourceDocumentType: string;
    companyId: string;
    tenantId: string;
    actorId: string | null;
    effectiveDate: Date;
    reversalOfId: string | null;
    createdAt: Date;
  }): StockMovement {
    return StockMovement.instantiate(
      StockMovementId.fromString(row.id),
      {
        id: row.id,
        grnLineId: row.grnLineId,
        productId: row.productId,
        quantity: row.quantity,
        movementType: row.movementType as MovementType,
        sourceDocumentId: row.sourceDocumentId,
        sourceDocumentType: row.sourceDocumentType,
        companyId: row.companyId,
        tenantId: row.tenantId,
        actorId: row.actorId ?? undefined,
        effectiveDate: row.effectiveDate,
        reversalOfId: row.reversalOfId ?? undefined,
        createdAt: row.createdAt,
      },
      1,
    );
  }
}
