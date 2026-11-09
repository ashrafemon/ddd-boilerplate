import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import { StockMovementCommandRepository } from '../../domain/repositories/stock-movement-command.repository';
import { StockBalanceRepository } from '../../domain/repositories/stock-movement-command.repository';
import { StockMovementFactory } from '../../domain/factories/stock-movement.factory';
import { InventoryPublisherPort } from '../publishes/publishers/inventory.publisher-port';
import { StockCalculationService } from '../../domain/services/stock-calculation.service';
import { StockBalance } from '../../domain/aggregates/stock-movement.aggregate';

interface RecordStockMovementInput {
  grnLineId: string;
  productId: string;
  quantity: number;
  movementType: string;
  sourceDocumentId: string;
  sourceDocumentType: string;
  actorId?: string | null;
  effectiveDate?: Date | null;
}

@Injectable()
export class RecordStockMovementUseCase {
  constructor(
    private readonly stockMovementRepository: StockMovementCommandRepository,
    private readonly stockBalanceRepository: StockBalanceRepository,
    private readonly integrationEvent: InventoryPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
    private readonly audit: AuditPort,
  ) {}

  @Transactional()
  async execute(input: RecordStockMovementInput): Promise<string> {
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new NotFoundException('Company not found in request context');
    }

    const abacResult = await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: 'StockMovement',
      action: 'record',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    const movementType =
      input.movementType === 'GOODS_RECEIPT_REVERSAL' ? 'GOODS_RECEIPT_REVERSAL' : 'GOODS_RECEIPT';

    const movement = StockMovementFactory.record({
      grnLineId: input.grnLineId,
      productId: input.productId,
      quantity: input.quantity,
      movementType,
      sourceDocumentId: input.sourceDocumentId,
      sourceDocumentType: input.sourceDocumentType,
      companyId,
      tenantId: ctx.tenantId ?? null,
      actorId: input.actorId ?? ctx.userId ?? null,
      effectiveDate: input.effectiveDate ?? new Date(),
    });

    await this.stockMovementRepository.save(movement);

    // Upsert stock balance projection in same transaction
    const existing = await this.stockBalanceRepository.findByProduct(
      input.productId,
      companyId,
      ctx.tenantId ?? undefined,
    );
    const delta = movementType === 'GOODS_RECEIPT_REVERSAL' ? -input.quantity : input.quantity;
    const now = new Date();

    if (existing) {
      existing.adjust(StockCalculationService.add(existing.quantity, delta), now);
      await this.stockBalanceRepository.save(existing);
    } else {
      const newBalance = StockBalance.instantiate(
        {
          id: crypto.randomUUID(),
          productId: input.productId,
          companyId,
          tenantId: ctx.tenantId ?? null,
          quantity: StockCalculationService.add(0, delta),
          updatedAt: now,
        },
        1,
      );
      await this.stockBalanceRepository.save(newBalance);
    }

    for (const event of movement.pullEvents()) {
      await this.integrationEvent.send(event, movement.id.toString());
    }

    return movement.id.toString();
  }
}
