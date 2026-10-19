import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CreateGrnRequest } from '../../domain/types/grn.types';
import { GrnFactory } from '../../domain/factories/grn.factory';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { PurchaseOrderPort } from '../outbound-ports/purchase-order-query.port';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnIntegrationPort } from '../integrations/publishes/grn.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';
import { NumberingPort } from '../outbound-ports/numbering.port';

@Injectable()
export class CreateGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly purchaseOrderQueryPort: PurchaseOrderPort,
    private readonly integrationEvent: GrnIntegrationPort,
    private readonly companyConfig: CompanyConfigPort,
    private readonly numbering: NumberingPort,
  ) {}

  @Transactional()
  async execute(input: CreateGrnRequest): Promise<GrnId> {
    const company = await this.companyConfig.getCompanyConfig();
    const currency = input.currency ?? company.defaultCurrency;

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
      lines: snappedLines,
    });

    await this.grnRepository.save(grn);

    for (const event of grn.pullEvents()) {
      await this.integrationEvent.send(event, grn.id.toString());
    }

    return grn.id;
  }
}
