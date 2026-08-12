import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import {
  MODULE_PORT_RESOLVER,
  ModulePortResolver,
} from '@business/shared-business/ports/module-port-resolver.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  COMPANY_CONFIG,
  CompanyConfigPort,
} from '@platform/configuration/ports/company-config.port';
import { purchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderErrors } from '../../domain/errors/purchase-order.errors';
import {
  PURCHASE_ORDER_VENDOR_PORT,
  OrderableVendorQueryPort,
} from '../ports/outbound/vendor-query.port';
import {
  PURCHASE_ORDER_COMMAND_REPOSITORY,
  PurchaseOrderCommandRepositoryPort,
} from '../../domain/ports/purchase-order-command-repository.port';

export interface CreatePurchaseOrderInput {
  vendorId: string;
  currency?: string;
}

@Injectable()
export class CreatePurchaseOrderUseCase implements CommandUseCase<
  CreatePurchaseOrderInput,
  PurchaseOrderId
> {
  constructor(
    @Inject(PURCHASE_ORDER_COMMAND_REPOSITORY)
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    @Inject(MODULE_PORT_RESOLVER) private readonly portResolver: ModulePortResolver,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  private get vendorQueryPort(): OrderableVendorQueryPort {
    return this.portResolver.resolvePort<OrderableVendorQueryPort>(PURCHASE_ORDER_VENDOR_PORT);
  }

  @Transactional()
  async execute(input: CreatePurchaseOrderInput): Promise<PurchaseOrderId> {
    // Orchestration step 1: resolve the company configuration from the platform.
    const company = await this.companyConfig.getCompanyConfig();
    const currency = input.currency ?? company.defaultCurrency;

    // Orchestration step 2: cross-aggregate call through the outbound port —
    // the Vendor module implements it; the system finds the adapter.
    const vendor = await this.vendorQueryPort.getOrderableVendor(input.vendorId);
    if (!vendor) {
      throw PurchaseOrderErrors.vendorNotOrderable();
    }

    // Orchestration step 3: build the aggregate through the domain factory.
    const sequence = await this.purchaseOrderRepository.nextOrderSequence();
    const purchaseOrder = purchaseOrderFactory.create({
      orderNumber: `PO-${String(sequence).padStart(8, '0')}`,
      vendorId: input.vendorId,
      currency,
    });

    // Orchestration step 4: persist + persist events to the outbox + dispatch.
    await this.purchaseOrderRepository.save(purchaseOrder);
    for (const event of purchaseOrder.pullEvents()) {
      await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrder.id.toString());
      this.eventBus.publish(event);
    }

    return purchaseOrder.id;
  }
}
