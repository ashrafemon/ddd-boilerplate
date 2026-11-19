import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { GrnFactory } from '../../domain/factories/grn.factory';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { CreateGrnRequest } from '../../domain/types/grn.types';
import { GrnPublisherPort } from '../publishes/publishers/grn.publisher-port';
import { NumberingPort } from '../outbound-ports/numbering.port';
import { PurchaseOrderPort } from '../outbound-ports/purchase-order-query.port';

/**
 * Create a GRN against an eligible PO (plan Phase 3.1): receiving-eligible
 * status only, vendor must match, every line references a real PO line and
 * its `orderedQuantity`/`unitPrice` are SNAPSHOT from the PO — client values
 * are ignored by design.
 *
 * Phase 1.4 idempotency lives at the HTTP boundary, not here: the controller
 * marks POST /grn with `@Idempotent()`, so a replayed request carrying the
 * `Idempotency-Key` header (or the body's optional `idempotencyKey`) returns
 * the first result instead of a second document. The use case deliberately
 * has no `IdempotencyPort`: GRN create has no natural key, and programmatic
 * callers are expected to supply a key at the edge. PO create is also not
 * double protected — `externalReference` find-or-create applies to import and
 * update, not to create.
 */
@Injectable()
export class CreateGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly purchaseOrderQueryPort: PurchaseOrderPort,
    private readonly integrationEvent: GrnPublisherPort,
    private readonly numbering: NumberingPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: CreateGrnRequest, actorId?: string): Promise<string> {
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
      resource: 'Grn',
      action: 'create',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    const currency = input.currency ?? ctx.defaultCurrency ?? 'USD';

    const purchaseOrder = await this.purchaseOrderQueryPort.getPurchaseOrder(input.purchaseOrderId);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    // Receiving-eligible statuses: ISSUED (or APPROVED for backward compat).
    const receivingEligible = ['ISSUED', 'APPROVED'];
    if (!receivingEligible.includes(purchaseOrder.status)) {
      throw new ConflictException(
        `Purchase order is not eligible for receiving (status: ${purchaseOrder.status})`,
      );
    }

    const vendorId = input.vendorId ?? purchaseOrder.vendorId;
    if (vendorId !== purchaseOrder.vendorId) {
      throw new ConflictException('GRN vendor does not match the purchase order vendor');
    }

    const grnNumber = await this.numbering.nextNumber('grn.number', {
      prefix: 'GRN-',
      padding: 8,
    });

    // Snapshot orderedQuantity/unitPrice from the PO lines (client values ignored).
    const poLineByProduct = new Map(purchaseOrder.lines.map(l => [l.productId, l]));
    const snappedLines = input.lines.map(line => {
      const poLine = poLineByProduct.get(line.productId);
      if (!poLine) {
        throw new ConflictException(`Product ${line.productId} is not on the purchase order`);
      }
      return {
        productId: line.productId,
        orderedQuantity: poLine.quantity,
        receivedQuantity: line.receivedQuantity,
        unitPrice: poLine.unitPrice,
      };
    });

    const grn = GrnFactory.create({
      grnNumber,
      purchaseOrderId: input.purchaseOrderId,
      vendorId,
      currency,
      createdBy: actorId,
      lines: snappedLines,
    });

    await this.grnRepository.save(grn);

    for (const event of grn.pullEvents()) {
      await this.integrationEvent.send(event, grn.id.toString());
    }

    return grn.id.toString();
  }
}
