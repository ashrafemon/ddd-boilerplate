import { StockMovement } from '@business/inventory/domain/aggregates/stock-movement.aggregate';
import { StockBalance } from '@business/inventory/domain/aggregates/stock-movement.aggregate';
import { StockMovementId } from '@business/inventory/domain/value-objects/stock-movement-id.vo';
import { StockMovementType } from '@business/inventory/domain/types/stock-movement.enum';
import { StockMovementQueryRecord } from '../../../domain/types/stock-movement.types';

export class PrismaStockMovementMapper {
  static toDomain(row: {
    id: string;
    grnLineId: string;
    productId: string;
    quantity: number;
    movementType: string;
    sourceDocumentId: string;
    sourceDocumentType: string;
    companyId: string;
    tenantId: string | null;
    actorId: string | null;
    effectiveDate: Date;
    reversalOfId: string | null;
    createdAt: Date;
  }): StockMovement {
    return StockMovement.instantiate(
      StockMovementId.fromString(row.id),
      {
        id: StockMovementId.fromString(row.id),
        grnLineId: row.grnLineId,
        productId: row.productId,
        quantity: row.quantity,
        movementType: row.movementType as StockMovementType,
        sourceDocumentId: row.sourceDocumentId,
        sourceDocumentType: row.sourceDocumentType,
        companyId: row.companyId,
        tenantId: row.tenantId,
        actorId: row.actorId,
        effectiveDate: row.effectiveDate,
        reversalOfId: row.reversalOfId,
        createdAt: row.createdAt,
      },
      1,
    );
  }

  static toRow(movement: StockMovement) {
    return {
      id: movement.id.toString(),
      grnLineId: movement.grnLineId,
      productId: movement.productId,
      quantity: movement.quantity,
      movementType: movement.movementType,
      sourceDocumentId: movement.sourceDocumentId,
      sourceDocumentType: movement.sourceDocumentType,
      companyId: movement.companyId,
      tenantId: movement.tenantId,
      actorId: movement.actorId,
      effectiveDate: movement.effectiveDate,
      reversalOfId: movement.reversalOfId,
      createdAt: movement.createdAt,
    };
  }

  static toRecord(row: never): StockMovementQueryRecord {
    const r = row as {
      id: string;
      grnLineId: string;
      productId: string;
      quantity: number;
      movementType: string;
      sourceDocumentId: string;
      sourceDocumentType: string;
      companyId: string;
      tenantId: string | null;
      actorId: string | null;
      effectiveDate: Date;
      reversalOfId: string | null;
      createdAt: Date;
    };
    return {
      id: r.id,
      grnLineId: r.grnLineId,
      productId: r.productId,
      quantity: r.quantity,
      movementType: r.movementType,
      sourceDocumentId: r.sourceDocumentId,
      sourceDocumentType: r.sourceDocumentType,
      companyId: r.companyId,
      tenantId: r.tenantId,
      actorId: r.actorId,
      effectiveDate: r.effectiveDate,
      reversalOfId: r.reversalOfId,
      createdAt: r.createdAt,
    };
  }

  static toBalanceDomain(row: {
    id: string;
    productId: string;
    companyId: string;
    tenantId: string | null;
    quantity: number;
    updatedAt: Date;
  }): StockBalance {
    return StockBalance.instantiate(
      {
        id: row.id,
        productId: row.productId,
        companyId: row.companyId,
        tenantId: row.tenantId,
        quantity: row.quantity,
        updatedAt: row.updatedAt,
      },
      1,
    );
  }
}
