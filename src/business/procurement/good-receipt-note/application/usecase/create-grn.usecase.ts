import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ModulePortResolver } from '@shared-kernel/ports';
import { CreateGrnRequest } from '../../domain/types/grn.types';
import { grnFactory } from '../../domain/factories';
import { GrnId } from '../../domain/value-objects';
import { PurchaseOrderQueryPort } from '../ports/outbound';
import { GrnCommandRepositoryPort } from '../../domain/ports';
import { GrnIntegrationPort } from '../integrations';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class CreateGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepositoryPort,
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

    const sequence = await this.grnRepository.nextGrnSequence();
    const grn = grnFactory.create({
      purchaseOrderId: input.purchaseOrderId,
      vendorId: purchaseOrder.vendorId,
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