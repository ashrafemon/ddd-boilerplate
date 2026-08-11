import { Module } from '@nestjs/common';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { CreatePurchaseOrderUseCase } from './application/use-cases/create-purchase-order.use-case';
import { AddPurchaseOrderLineUseCase } from './application/use-cases/add-purchase-order-line.use-case';
import { RemovePurchaseOrderLineUseCase } from './application/use-cases/remove-purchase-order-line.use-case';
import { PurchaseOrderTransitionUseCase } from './application/use-cases/purchase-order-transition.use-case';
import { PurchaseOrderQueryService } from './application/queries/purchase-order-query.service';
import { PurchaseOrderCommandService } from './application/purchase-order-command.service';
import { VendorQueryAdapter } from './application/adapters/vendor-query.adapter';
import { ProductQueryAdapter } from './application/adapters/product-query.adapter';
import { PURCHASE_ORDER_COMMAND_PORT } from './ports/inbound/purchase-order.command.port';
import { PURCHASE_ORDER_QUERY_PORT } from './ports/inbound/purchase-order.query.port';
import { PURCHASE_ORDER_VENDOR_PORT } from './ports/outbound/vendor-query.port';
import { PURCHASE_ORDER_PRODUCT_PORT } from './ports/outbound/product-query.port';
import { VendorModule } from '@business/vendor/vendor.module';
import { ProductModule } from '@business/product/product.module';

@Module({
  imports: [VendorModule, ProductModule],
  controllers: [PurchaseOrderController],
  providers: [
    CreatePurchaseOrderUseCase,
    AddPurchaseOrderLineUseCase,
    RemovePurchaseOrderLineUseCase,
    PurchaseOrderTransitionUseCase,
    PurchaseOrderQueryService,
    PurchaseOrderCommandService,
    VendorQueryAdapter,
    ProductQueryAdapter,
    { provide: PURCHASE_ORDER_VENDOR_PORT, useExisting: VendorQueryAdapter },
    { provide: PURCHASE_ORDER_PRODUCT_PORT, useExisting: ProductQueryAdapter },
    { provide: PURCHASE_ORDER_COMMAND_PORT, useExisting: PurchaseOrderCommandService },
    { provide: PURCHASE_ORDER_QUERY_PORT, useExisting: PurchaseOrderQueryService },
  ],
  exports: [
    PurchaseOrderCommandService,
    PurchaseOrderQueryService,
    PURCHASE_ORDER_COMMAND_PORT,
    PURCHASE_ORDER_QUERY_PORT,
  ],
})
export class PurchaseOrderModule {}
