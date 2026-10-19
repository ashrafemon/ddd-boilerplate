import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnIntegrationPort } from '../integrations/publishes/grn.integration-port';
import { PurchaseOrderPort } from '../outbound-ports/purchase-order-query.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { AuditPort } from '@platform/audit/ports/audit.port';
import { IdempotencyPort } from '@platform/idempotency/ports/idempotency.port';
import { GoodsReceiptPosted } from '../../domain/events/grn.posted.event';
import { ReadCachePort } from '../outbound-ports/read-cache.port';

@Injectable()
export class PostGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly purchaseOrderPort: PurchaseOrderPort,
    private readonly integrationEvent: GrnIntegrationPort,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
    private readonly readCache: ReadCachePort,
    private readonly idempotency: IdempotencyPort,
  ) {}

  @Transactional()
  async execute(input: { id: string; actorId?: string; idempotencyKey?: string }): Promise<GrnId> {
    // Guarded by `IdempotencyPort` scope `grn.post` (plan §1.4/§3.5): posting is
    // the costly, side-effecting command — it registers the receipt on the PO,
    // moves stock and emits `GoodsReceiptPosted`. A redelivered request must
    // replay the original result, never post twice.
    //
    // The key falls back to the GRN id (see `PostGrnDto`), so the command is
    // replay-safe even when the client sends no key: a second post of the same
    // GRN replays the first result instead of double-registering the receipt.
    const key = input.idempotencyKey ?? input.id;

    const tenantId = this.requestContext.getTenantId() ?? '';
    const companyId = this.requestContext.getCompanyId() ?? '';

    const reservation = await this.idempotency.reserve({
      tenantId,
      companyId,
      scope: 'grn.post',
      key,
    });

    if (reservation.status === 'REPLAY') {
      return GrnId.fromString(String(reservation.result));
    }
    if (reservation.status === 'BUSY') {
      throw new ConflictException('A post with this idempotency key is already in progress');
    }
    if (reservation.status === 'KEY_MISMATCH') {
      throw new BadRequestException('This idempotency key was used for a different request');
    }

    try {
      const id = await this.post(input);
      await this.idempotency.complete({
        reservation: reservation.reservation,
        result: id.toString(),
      });
      return id;
    } catch (error) {
      await this.idempotency.fail({ reservation: reservation.reservation });
      throw error;
    }
  }

  private async post(input: { id: string; actorId?: string }): Promise<GrnId> {
    const tenantId = this.requestContext.getTenantId() ?? '';
    const companyId = this.requestContext.getCompanyId() ?? '';
    const actorId = input.actorId ?? this.requestContext.getUserId();

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

    await this.readCache.invalidate(`grn:${grn.id.toString()}`);

    return grn.id;
  }
}
