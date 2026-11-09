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

interface ReverseStockMovementInput {
  movementId: string;
  actorId?: string | null;
  reason?: string | null;
}

@Injectable()
export class ReverseStockMovementUseCase {
  constructor(
    private readonly stockMovementRepository: StockMovementCommandRepository,
    private readonly stockBalanceRepository: StockBalanceRepository,
    private readonly integrationEvent: InventoryPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
    private readonly audit: AuditPort,
  ) {}

  @Transactional()
  async execute(input: ReverseStockMovementInput): Promise<string> {
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
      action: 'reverse',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    const original = await this.stockMovementRepository.findById(input.movementId);
    if (!original) {
      throw new NotFoundException('Stock movement not found');
    }

    const reversal = StockMovementFactory.record({
      grnLineId: original.grnLineId,
      productId: original.productId,
      quantity: original.quantity,
      movementType: 'GOODS_RECEIPT_REVERSAL',
      sourceDocumentId: input.reason ?? input.movementId,
      sourceDocumentType: 'stock-movement-reversal',
      companyId,
      tenantId: ctx.tenantId ?? null,
      actorId: input.actorId ?? ctx.userId ?? null,
      effectiveDate: new Date(),
    });

    await this.stockMovementRepository.save(reversal);

    // Upsert stock balance projection (negative adjustment for reversal)
    const existing = await this.stockBalanceRepository.findByProduct(
      original.productId,
      companyId,
      ctx.tenantId ?? undefined,
    );
    const now = new Date();

    if (existing) {
      existing.adjust(StockCalculationService.add(existing.quantity, -original.quantity), now);
      await this.stockBalanceRepository.save(existing);
    } else {
      const newBalance = StockBalance.instantiate(
        {
          id: crypto.randomUUID(),
          productId: original.productId,
          companyId,
          tenantId: ctx.tenantId ?? null,
          quantity: StockCalculationService.add(0, -original.quantity),
          updatedAt: now,
        },
        1,
      );
      await this.stockBalanceRepository.save(newBalance);
    }

    for (const event of reversal.pullEvents()) {
      await this.integrationEvent.send(event, reversal.id.toString());
    }

    return reversal.id.toString();
  }
}
