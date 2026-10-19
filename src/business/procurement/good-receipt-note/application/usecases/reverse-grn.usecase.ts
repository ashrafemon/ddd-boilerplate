import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { IdempotencyPort } from '@platform/idempotency/ports/idempotency.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { AuditPort } from '@platform/audit/ports/audit.port';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnIntegrationPort } from '../integrations/publishes/grn.integration-port';
import { PurchaseOrderPort } from '../outbound-ports/purchase-order-query.port';
import { NumberingPort } from '../outbound-ports/numbering.port';
import { GrnReadCache } from '../outbound-ports/read-cache.port';
import { GrnFactory } from '../../domain/factories/grn.factory';
import { GoodsReceiptReversed } from '../../domain/events/grn.reversed.event';

/** The quantity `post` registered on the PO — a reversal returns exactly this. */
const postedQuantity = (line: { acceptedQuantity: number; receivedQuantity: number }): number =>
  line.acceptedQuantity > 0 ? line.acceptedQuantity : line.receivedQuantity;

/**
 * Reverse a POSTED GRN (plan Phase 4.1 / spec §5.3, invariants GRN-05):
 *
 * - Creates a COMPENSATING DOCUMENT (`reversalOfId` → original) with mirrored
 *   NEGATIVE quantities; the original rows are never mutated (history preserved).
 * - Returns the PO receiving balance by registering the mirror via the PO
 *   public port — PO-07's upper bound is unaffected by negatives, so a
 *   reversal can never exceed what the original posted.
 * - Guarded by `IdempotencyPort` scope `grn.reverse`: redelivery replays the
 *   original result, never a second compensation. At most one reversal per
 *   original (409 otherwise).
 * - Emits `GoodsReceiptReversed` for inventory's compensating movements and
 *   writes an audit row — all inside this use case's transaction.
 */
@Injectable()
export class ReverseGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly purchaseOrderPort: PurchaseOrderPort,
    private readonly integrationEvent: GrnIntegrationPort,
    private readonly idempotency: IdempotencyPort,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
    private readonly numbering: NumberingPort,
    private readonly readCache: GrnReadCache,
  ) {}

  @Transactional()
  async execute(input: { id: string; idempotencyKey?: string; actorId?: string }): Promise<GrnId> {
    const tenantId = this.requestContext.getTenantId() ?? '';
    const companyId = this.requestContext.getCompanyId() ?? '';
    const actorId = input.actorId ?? this.requestContext.getUserId();
    const key = input.idempotencyKey ?? `grn.reverse:${input.id}`;

    const reserveResult = await this.idempotency.reserve({
      tenantId,
      companyId,
      scope: 'grn.reverse',
      key,
    });

    if (reserveResult.status === 'REPLAY') {
      return GrnId.fromString(reserveResult.result as string);
    }
    if (reserveResult.status === 'BUSY') {
      throw new ConflictException('GRN reverse is already in progress');
    }
    if (reserveResult.status === 'KEY_MISMATCH') {
      throw new ConflictException('Idempotency key mismatch');
    }

    const reservation = reserveResult.reservation;

    try {
      const original = await this.grnRepository.findById(input.id);
      if (!original) {
        throw new NotFoundException('GRN not found');
      }

      if (String(original.status) !== 'COMPLETED') {
        throw new ConflictException(
          `Only a posted GRN can be reversed (status: ${original.status})`,
        );
      }

      const alreadyReversed = await this.grnRepository.findByReversalOfId(original.id.toString());
      if (alreadyReversed) {
        throw new ConflictException('GRN has already been reversed');
      }

      const reversalLines = original.lines.map(line => {
        const eligible = postedQuantity(line);
        return {
          productId: line.productId,
          orderedQuantity: line.orderedQuantity,
          receivedQuantity: -eligible,
          acceptedQuantity: -eligible,
          rejectedQuantity: 0,
          unitPrice: line.unitPrice,
        };
      });

      const grnNumber = await this.numbering.nextNumber('grn.number', {
        prefix: 'GRN-',
        padding: 8,
      });

      const reversal = GrnFactory.createReversal({
        grnNumber,
        reversalOfId: original.id.toString(),
        purchaseOrderId: original.purchaseOrderId,
        vendorId: original.vendorId,
        currency: original.currency,
        actorId,
        lines: reversalLines,
      });

      // PO receiving balance returns (mirror of what `post` registered).
      await this.purchaseOrderPort.registerReceipt({
        purchaseOrderId: original.purchaseOrderId,
        lines: reversalLines.map(l => ({
          productId: l.productId,
          receivedQuantity: l.receivedQuantity,
        })),
      });

      await this.grnRepository.save(reversal);
      // The ORIGINAL's read model changed (it is now reversed); the new
      // reversal document has never been cached.
      await this.readCache.invalidate(original.id.toString());

      await this.audit.record({
        action: 'grn.reverse',
        entityType: 'GoodReceiptNote',
        entityId: original.id.toString(),
        actorId,
        tenantId,
        companyId,
        changes: { reversalId: reversal.id.toString(), status: original.status },
      });

      await this.integrationEvent.send(
        new GoodsReceiptReversed(
          reversal.id.toString(),
          original.id.toString(),
          original.purchaseOrderId,
          reversalLines.map(l => ({
            grnLineId: `${reversal.id.toString()}:${l.productId}`,
            productId: l.productId,
            acceptedQuantity: l.acceptedQuantity,
            unitPrice: l.unitPrice,
          })),
        ),
        reversal.id.toString(),
      );

      await this.idempotency.complete({
        reservation,
        result: reversal.id.toString(),
      });

      return reversal.id;
    } catch (error) {
      await this.idempotency.fail({ reservation });
      throw error;
    }
  }
}
