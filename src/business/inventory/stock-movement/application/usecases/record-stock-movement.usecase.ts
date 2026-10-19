import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { StockMovementFactory } from '../../domain/factories/stock-movement.factory';
import { StockMovementCommandRepository } from '../../domain/repositories/stock-movement-command.repository';
import { MovementType } from '../../domain/types/stock-movement.types';
import { StockMovement } from '../../domain/aggregates/stock-movement.aggregate';

export interface RecordStockMovementInput {
  grnLineId: string;
  productId: string;
  quantity: number;
  movementType: MovementType;
  sourceDocumentId: string;
  sourceDocumentType: string;
  companyId: string;
  tenantId: string;
  actorId?: string;
  /** Original movement this entry compensates (GOODS_RECEIPT_REVERSAL only). */
  reversalOfId?: string;
}

@Injectable()
export class RecordStockMovementUseCase {
  constructor(private readonly repository: StockMovementCommandRepository) {}

  @Transactional()
  async execute(input: RecordStockMovementInput): Promise<StockMovement> {
    // Natural idempotency: check if movement already exists for this grnLine + type.
    const existing = await this.repository.findByGrnLineAndType(
      input.grnLineId,
      input.movementType,
    );
    if (existing) {
      return existing;
    }

    const movement = StockMovementFactory.create(input);
    await this.repository.save(movement);
    return movement;
  }
}
