import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnIntegrationPort } from '../integrations/publishes/grn.integration-port';
import { PurchaseOrderPort } from '../outbound-ports/purchase-order-query.port';
import { IdempotencyPort } from '@platform/idempotency/ports/idempotency.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { AuditPort } from '@platform/audit/ports/audit.port';
import { GoodsReceiptPosted } from '../../domain/events/grn.posted.event';
import { GrnReadCache } from '../outbound-ports/read-cache.port';

@Injectable()
export class PostGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly purchaseOrderPort: PurchaseOrderPort,
    private readonly integrationEvent: GrnIntegrationPort,
    private readonly idempotency: IdempotencyPort,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
    private readonly readCache: GrnReadCache,
  ) {}

  @Transactional()
  async execute(input: { id: string; idempotencyKey?: string; actorId?: string }): Promise<GrnId> {
    const tenantId = this.requestContext.getTenantId() ?? '';
    const companyId = this.requestContext.getCompanyId() ?? '';
    const actorId = input.actorId ?? this.requestContext.getUserId();
    const key = input.idempotencyKey ?? input.id;

    const reserveResult = await this.idempotency.reserve({
      tenantId,
      companyId,
      scope: 'grn.post',
      key,
    });

    if (reserveResult.status === 'REPLAY') {
      return GrnId.fromString(reserveResult.result as string);
    }
    if (reserveResult.status === 'BUSY') {
      throw new ConflictException('GRN post is already in progress');
    }
    if (reserveResult.status === 'KEY_MISMATCH') {
      throw new ConflictException('Idempotency key mismatch');
    }

    const reservation = reserveResult.reservation;

    try {
      const grn = await this.grnRepository.findById(input.id);
      if (!grn) {
        throw new NotFoundException('GRN not found');
      }

      if (String(grn.status) !== 'RECEIVED') {
        throw new ConflictException(`GRN cannot be posted from status ${grn.status}`);
      }

      // Register receipt on the PO (atomic receiving balance, PO-07).
      await this.purchaseOrderPort.registerReceipt({
        purchaseOrderId: grn.purchaseOrderId,
        lines: grn.lines.map(l => ({
          productId: l.productId,
          receivedQuantity: l.acceptedQuantity > 0 ? l.acceptedQuantity : l.receivedQuantity,
        })),
      });

      grn.complete(actorId);
      await this.grnRepository.update(grn);
      await this.readCache.invalidate(grn.id.toString());

      await this.audit.record({
        action: 'grn.post',
        entityType: 'GoodReceiptNote',
        entityId: grn.id.toString(),
        actorId,
        tenantId,
        companyId,
        changes: { status: grn.status },
      });

      for (const event of grn.pullEvents()) {
        await this.integrationEvent.send(event, grn.id.toString());
      }

      // Emit GoodsReceiptPosted for downstream consumers (inventory).
      await this.integrationEvent.send(
        new GoodsReceiptPosted(
          grn.id.toString(),
          grn.purchaseOrderId,
          grn.lines.map(l => ({
            grnLineId: `${grn.id.toString()}:${l.productId}`,
            productId: l.productId,
            acceptedQuantity: l.acceptedQuantity > 0 ? l.acceptedQuantity : l.receivedQuantity,
            unitPrice: l.unitPrice,
          })),
        ),
        grn.id.toString(),
      );

      await this.idempotency.complete({
        reservation,
        result: grn.id.toString(),
      });

      return grn.id;
    } catch (error) {
      await this.idempotency.fail({ reservation });
      throw error;
    }
  }
}
