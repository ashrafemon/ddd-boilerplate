import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnIntegrationPort } from '../integrations/publishes/grn.integration-port';
import { PurchaseOrderPort } from '../outbound-ports/purchase-order-query.port';
import { IdempotencyPort } from '@platform/idempotency/ports/idempotency.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';

@Injectable()
export class ReverseGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly purchaseOrderPort: PurchaseOrderPort,
    private readonly integrationEvent: GrnIntegrationPort,
    private readonly idempotency: IdempotencyPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  async execute(input: { id: string; idempotencyKey?: string }): Promise<GrnId> {
    const tenantId = this.requestContext.getTenantId() ?? '';
    const companyId = this.requestContext.getCompanyId() ?? '';
    const key = input.idempotencyKey ?? input.id;

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
      const grn = await this.grnRepository.findById(input.id);
      if (!grn) {
        throw new NotFoundException('GRN not found');
      }

      if (String(grn.status) !== 'RECEIVED') {
        throw new ConflictException(`GRN cannot be reversed from status ${grn.status}`);
      }

      // Create compensating reversal: call PO registerReceipt with negative quantities.
      await this.purchaseOrderPort.registerReceipt({
        purchaseOrderId: grn.purchaseOrderId,
        lines: grn.lines.map(l => ({
          productId: l.productId,
          receivedQuantity: -(l.acceptedQuantity > 0 ? l.acceptedQuantity : l.receivedQuantity),
        })),
      });

      grn.cancel();
      await this.grnRepository.update(grn);

      for (const event of grn.pullEvents()) {
        await this.integrationEvent.send(event, grn.id.toString());
      }

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
