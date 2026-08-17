import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import { MODULE_PORT_RESOLVER, ModulePortResolver } from '@shared-kernel/ports';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  COMPANY_CONFIG,
  CompanyConfigPort,
} from '@platform/configuration/ports/company-config.port';
import { Money } from '@business/shared-business/domain/money.value-object';
import { PurchaseOrderId } from '../../domain/value-objects';
import { PurchasableProductQueryPort } from '../ports/outbound';
import { PurchaseOrderCommandRepositoryPort } from '../../domain/domain-ports';

export interface AddLineInput {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
}

@Injectable()
export class AddPurchaseOrderLineUseCase implements CommandUseCase<AddLineInput, PurchaseOrderId> {
  constructor(
    @Inject(PurchaseOrderCommandRepositoryPort)
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    @Inject(MODULE_PORT_RESOLVER) private readonly portResolver: ModulePortResolver,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  private get productQueryPort(): PurchasableProductQueryPort {
    return this.portResolver.resolvePort<PurchasableProductQueryPort>(PurchasableProductQueryPort);
  }

  @Transactional()
  async execute(input: AddLineInput): Promise<PurchaseOrderId> {
    await this.companyConfig.getCompanyConfig();

    const id = PurchaseOrderId.fromString(input.id);
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    const product = await this.productQueryPort.getPurchasableProduct(input.productId);
    if (!product) {
      throw new ConflictException('Product is not purchasable (inactive or discontinued)');
    }

    purchaseOrder.addLine(
      input.productId,
      input.quantity,
      Money.fromDecimal(input.unitPrice, input.currency ?? purchaseOrder.currency),
    );
    await this.purchaseOrderRepository.update(purchaseOrder);

    for (const event of purchaseOrder.pullEvents()) {
      await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrder.id.toString());
    }

    return purchaseOrder.id;
  }
}
