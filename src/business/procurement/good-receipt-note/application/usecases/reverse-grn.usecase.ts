import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnPublisherPort } from '../integrations/publishes/grn.publisher-port';
import { PurchaseOrderPort } from '../outbound-ports/purchase-order-query.port';
import { NumberingPort } from '../outbound-ports/numbering.port';
import { GrnFactory } from '../../domain/factories/grn.factory';

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
 * - Idempotency is enforced at the controller endpoint via `@Idempotent()`.
 * - Emits `GoodsReceiptReversed` for inventory's compensating movements and
 *   writes an audit row — all inside this use case's transaction.
 */
@Injectable()
export class ReverseGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly purchaseOrderPort: PurchaseOrderPort,
    private readonly integrationEvent: GrnPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
    private readonly numbering: NumberingPort,
  ) {}

  @Transactional()
  async execute(input: { id: string; actorId?: string }): Promise<string> {
    const actorId = input.actorId ?? this.requestContext.getUserId();
    const tenantId = this.requestContext.getTenantId() ?? '';
    const companyId = this.requestContext.getCompanyId() ?? '';

    const original = await this.grnRepository.findById(input.id);
    if (!original) {
      throw new NotFoundException('GRN not found');
    }

    invariantRegistry.enforce('grn.reversible', { status: original.status });

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

    await this.purchaseOrderPort.registerReceipt({
      purchaseOrderId: original.purchaseOrderId,
      lines: reversalLines.map(l => ({
        productId: l.productId,
        receivedQuantity: l.receivedQuantity,
      })),
    });

    await this.grnRepository.save(reversal);

    await this.audit.record({
      action: 'grn.reverse',
      entityType: 'GoodReceiptNote',
      entityId: original.id.toString(),
      actorId,
      tenantId,
      companyId,
      changes: { reversalId: reversal.id.toString(), status: original.status },
    });

    for (const event of reversal.pullEvents()) {
      await this.integrationEvent.send(event, reversal.id.toString());
    }

    return reversal.id.toString();
  }
}
