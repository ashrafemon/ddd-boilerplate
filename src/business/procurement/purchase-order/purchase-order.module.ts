import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { ProductModule } from '@business/product-management/product/product.module';
import { VendorModule } from '@business/party/vendor/vendor.module';
import { PurchaseOrderController } from './presentation/http/purchase-order.controller';
import { PurchaseOrderForGrnFacade } from './application/facades/purchase-order-for-grn.facade';
import { PurchaseOrderForBillingPort } from '@business/procurement/purchase-order/public/ports/purchase-order-for-billing.port';
import { PurchaseOrderForBillingFacade } from './application/facades/purchase-order-for-billing.facade';
import { CreatePurchaseOrderUseCase } from './application/use-cases/create-purchase-order.usecase';
import { AddPurchaseOrderLineUseCase } from './application/use-cases/add-purchase-order-line.usecase';
import { UpdatePurchaseOrderUseCase } from './application/use-cases/update-purchase-order.usecase';
import { UpdatePurchaseOrderLineUseCase } from './application/use-cases/update-purchase-order-line.usecase';
import { RemovePurchaseOrderLineUseCase } from './application/use-cases/remove-purchase-order-line.usecase';
import { SubmitPurchaseOrderUseCase } from './application/use-cases/submit-purchase-order.usecase';
import { ApprovePurchaseOrderUseCase } from './application/use-cases/approve-purchase-order.usecase';
import { RejectPurchaseOrderUseCase } from './application/use-cases/reject-purchase-order.usecase';
import { CancelPurchaseOrderUseCase } from './application/use-cases/cancel-purchase-order.usecase';
import { CompletePurchaseOrderUseCase } from './application/use-cases/complete-purchase-order.usecase';
import { AmendPurchaseOrderUseCase } from './application/use-cases/amend-purchase-order.usecase';
import { IssuePurchaseOrderUseCase } from './application/use-cases/issue-purchase-order.usecase';
import { ClosePurchaseOrderUseCase } from './application/use-cases/close-purchase-order.usecase';
import { GetPurchaseOrderReceiptsUseCase } from './application/use-cases/get-purchase-order-receipts.usecase';
import { GetPurchaseOrderRemainingQuantitiesUseCase } from './application/use-cases/get-purchase-order-remaining-quantities.usecase';
import { RegisterPurchaseOrderReceiptUseCase } from './application/use-cases/register-purchase-order-receipt.usecase';
import { HasPurchaseOrderReceiptsUseCase } from './application/use-cases/has-purchase-order-receipts.usecase';
import { ImportPurchaseOrderUseCase } from './application/use-cases/import-purchase-order.usecase';
import { GetPurchaseOrderUseCase } from './application/use-cases/get-purchase-order.usecase';
import { ListPurchaseOrdersUseCase } from './application/use-cases/list-purchase-orders.usecase';
import { CreateRecurringPurchaseOrderUseCase } from './application/use-cases/create-recurring-purchase-order.usecase';
import { CreateRecurringFromPurchaseOrderUseCase } from './application/use-cases/create-recurring-from-purchase-order.usecase';
import { GenerateRecurringPurchaseOrderUseCase } from './application/use-cases/generate-recurring-purchase-order.usecase';
import { RecurringPurchaseOrderGenerationFacade } from './application/facades/recurring-purchase-order-generation.facade';
import { GoodsReceiptPostedListener } from './integrations/consumes/listeners/goods-receipt-posted.listener';
import { VendorBillPostedListener } from './integrations/consumes/listeners/vendor-bill-posted.listener';
import { HandleVendorBillPostedUseCase } from './application/use-cases/handle-vendor-bill-posted.usecase';
import { PurchaseOrderCommandRepository } from './domain/repositories/purchase-order-command.repository';
import { PurchaseOrderQuery } from './application/queries/purchase-order.query';
import { PurchaseOrderPublisherPort } from './application/publishes/publishers/purchase-order.publisher-port';
import { PurchasableProductPort } from './application/outbound-ports/product-query.port';
import { OrderableVendorPort } from './application/outbound-ports/vendor-query.port';
import { NumberingPort } from './application/outbound-ports/numbering.port';
import { ReadCachePort } from './application/outbound-ports/read-cache.port';
import { PurchaseOrderForGrnPort } from '@business/procurement/purchase-order/public/ports/purchase-order-for-grn.port';
import { RecurringPurchaseOrderGenerationPort } from '@business/procurement/purchase-order/public/ports/recurring-purchase-order-generation.port';
import { PrismaPurchaseOrderCommandRepository } from './infrastructure/persistence/prisma/prisma-purchase-order-command.repository';
import { PrismaPurchaseOrderQueryRepository } from './infrastructure/persistence/prisma/prisma-purchase-order-query.repository';
import { SharedOutboxAdapter } from '@platform/platform-common/outbox/adapters/shared-outbox.adapter';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { NumberingAdapter } from './infrastructure/adapters/platform/numbering.adapter';
import { ReadCacheAdapter } from './infrastructure/adapters/platform/read-cache.adapter';
import { PurchasableProductAdapter } from './infrastructure/adapters/business-aggregate/purchasable-product.adapter';
import { OrderableVendorAdapter } from './infrastructure/adapters/business-aggregate/orderable-vendor.adapter';
import { PurchaseOrderBatchOperationAdapter } from './infrastructure/adapters/platform/purchase-order-batch-operation.adapter';
import { PurchaseOrderNotificationAdapter } from './infrastructure/adapters/platform/purchase-order-notification.adapter';
import { PurchaseOrderImportHandler } from './infrastructure/adapters/platform/purchase-order-import.adapter';

@Module({
  imports: [PlatformModule, ProductModule, VendorModule],
  controllers: [PurchaseOrderController],
  providers: [
    PurchaseOrderBatchOperationAdapter,
    PurchaseOrderNotificationAdapter,
    PurchaseOrderImportHandler,
    CreatePurchaseOrderUseCase,
    ImportPurchaseOrderUseCase,
    AddPurchaseOrderLineUseCase,
    UpdatePurchaseOrderUseCase,
    UpdatePurchaseOrderLineUseCase,
    RemovePurchaseOrderLineUseCase,
    SubmitPurchaseOrderUseCase,
    ApprovePurchaseOrderUseCase,
    RejectPurchaseOrderUseCase,
    CancelPurchaseOrderUseCase,
    CompletePurchaseOrderUseCase,
    AmendPurchaseOrderUseCase,
    IssuePurchaseOrderUseCase,
    ClosePurchaseOrderUseCase,
    RegisterPurchaseOrderReceiptUseCase,
    HasPurchaseOrderReceiptsUseCase,
    // Read-model cache (plan §1.6): the query use case reads through the
    // module-local read cache, and every command use case that mutates a
    // purchase order invalidates the same key after a successful write.
    GetPurchaseOrderUseCase,
    GetPurchaseOrderReceiptsUseCase,
    GetPurchaseOrderRemainingQuantitiesUseCase,
    ListPurchaseOrdersUseCase,
    CreateRecurringPurchaseOrderUseCase,
    CreateRecurringFromPurchaseOrderUseCase,
    GenerateRecurringPurchaseOrderUseCase,
    RecurringPurchaseOrderGenerationFacade,
    GoodsReceiptPostedListener,
    VendorBillPostedListener,
    HandleVendorBillPostedUseCase,
    PurchaseOrderForGrnFacade,
    PurchaseOrderForBillingFacade,
    { provide: PurchaseOrderForGrnPort, useExisting: PurchaseOrderForGrnFacade },
    { provide: PurchaseOrderForBillingPort, useExisting: PurchaseOrderForBillingFacade },
    {
      provide: RecurringPurchaseOrderGenerationPort,
      useExisting: RecurringPurchaseOrderGenerationFacade,
    },
    { provide: PurchaseOrderCommandRepository, useClass: PrismaPurchaseOrderCommandRepository },
    { provide: PurchaseOrderQuery, useClass: PrismaPurchaseOrderQueryRepository },
    {
      provide: PurchaseOrderPublisherPort,
      useFactory: (outboxWriter: OutboxWriterPort) =>
        new SharedOutboxAdapter(outboxWriter, 'PurchaseOrder'),
      inject: [OutboxWriterPort],
    },
    { provide: NumberingPort, useClass: NumberingAdapter },
    { provide: ReadCachePort, useClass: ReadCacheAdapter },
    { provide: PurchasableProductPort, useClass: PurchasableProductAdapter },
    { provide: OrderableVendorPort, useClass: OrderableVendorAdapter },
  ],
  exports: [
    PurchaseOrderForGrnPort,
    PurchaseOrderForBillingPort,
    RecurringPurchaseOrderGenerationPort,
  ],
})
export class PurchaseOrderModule {}
