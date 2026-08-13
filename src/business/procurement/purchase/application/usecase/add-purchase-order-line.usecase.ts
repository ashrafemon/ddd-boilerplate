import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import {
  MODULE_PORT_RESOLVER,
  ModulePortResolver,
} from '@business/shared-business/ports';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  COMPANY_CONFIG,
  CompanyConfigPort,
} from '@platform/configuration/ports/company-config.port';
import { Money } from '@business/shared-business/domain/money.value-object';
import { PurchaseOrderId } from '../../domain/value-objects';
import { PurchaseOrderErrors } from '../../domain/errors';
import {
  PURCHASE_ORDER_PRODUCT_PORT,
  PurchasableProductQueryPort,
} from '../ports/outbound';
import {
  PURCHASE_ORDER_COMMAND_REPOSITORY,
  PurchaseOrderCommandRepositoryPort,
} from '../../domain/ports';

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
    @Inject(PURCHASE_ORDER_COMMAND_REPOSITORY)
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    @Inject(MODULE_PORT_RESOLVER) private readonly portResolver: ModulePortResolver,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  private get productQueryPort(): PurchasableProductQueryPort {
    return this.portResolver.resolvePort<PurchasableProductQueryPort>(PURCHASE_ORDER_PRODUCT_PORT);
  }

  @Transactional()
  async execute(input: AddLineInput): Promise<PurchaseOrderId> {
    await this.companyConfig.getCompanyConfig();

    const id = PurchaseOrderId.fromString(input.id);
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw PurchaseOrderErrors.notFound();
    }

    // Cross-aggregate call: the Product module implements the outbound port;
    // the system finds the adapter.
    const product = await this.productQueryPort.getPurchasableProduct(input.productId);
    if (!product) {
      throw PurchaseOrderErrors.productNotPurchasable();
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
