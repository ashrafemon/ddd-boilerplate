import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ModulePortResolver } from '@shared-kernel/ports';
import { CreateGrnRequest } from '../../domain/types/grn.types';
import { GrnFactory } from '../../domain/factories/grn.factory';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { PurchaseOrderQueryPort } from '../ports/outbound/purchase-order-query.port';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnIntegrationPort } from '../integrations/publishes/grn.integration-port';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class CreateGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly portResolver: ModulePortResolver,
    private readonly integrationEvent: GrnIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  private get purchaseOrderQueryPort(): PurchaseOrderQueryPort {
    return this.portResolver.resolvePort<PurchaseOrderQueryPort>(PurchaseOrderQueryPort);
  }

  @Transactional()
  async execute(input: CreateGrnRequest): Promise<GrnId> {
    const company = await this.companyConfig.getCompanyConfig();
    const currency = input.currency ?? company.defaultCurrency;

    const purchaseOrder = await this.purchaseOrderQueryPort.getPurchaseOrder(input.purchaseOrderId);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    const grn = GrnFactory.create({
      purchaseOrderId: input.purchaseOrderId,
      vendorId: input.vendorId,
      currency,
      lines: input.lines,
    });

    await this.grnRepository.save(grn);

    for (const event of grn.pullEvents()) {
      await this.integrationEvent.send(event, grn.id.toString());
    }

    return grn.id;
  }
}
