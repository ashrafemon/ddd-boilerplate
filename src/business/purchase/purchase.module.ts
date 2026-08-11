import { Module } from '@nestjs/common';
import { PurchaseOrderApprovalSaga } from './application/service/purchase-order-approval.saga';
import { PurchaseOrderLifecycleFacade } from './application/facade/purchase-order-lifecycle.facade';
import { ApprovePurchaseOrderPort } from './application/port/approve-purchase-order.port';
import { CreatePurchaseOrderPort } from './application/port/create-purchase-order.port';
import { GetPurchaseOrderPort } from './application/port/get-purchase-order.port';
import { PurchaseOrderLifecyclePort } from './application/port/purchase-order-lifecycle.port';
import { CancelPurchaseOrderPort, CompletePurchaseOrderPort, RejectPurchaseOrderPort } from './application/port/purchase-order-status.port';
import { SubmitPurchaseOrderPort } from './application/port/submit-purchase-order.port';
import { UpdatePurchaseOrderPort } from './application/port/update-purchase-order.port';
import { ApprovePurchaseOrderUseCase } from './application/use-case/approve-purchase-order/approve-purchase-order.use-case';
import { CreatePurchaseOrderUseCase } from './application/use-case/create-purchase-order/create-purchase-order.use-case';
import { GetPurchaseOrderUseCase } from './application/use-case/get-purchase-order/get-purchase-order.use-case';
import { CancelPurchaseOrderUseCase, CompletePurchaseOrderUseCase, RejectPurchaseOrderUseCase } from './application/use-case/purchase-order-status/purchase-order-status.use-case';
import { SubmitPurchaseOrderUseCase } from './application/use-case/submit-purchase-order/submit-purchase-order.use-case';
import { UpdatePurchaseOrderUseCase } from './application/use-case/update-purchase-order/update-purchase-order.use-case';
import { DocumentNumberGeneratorPort } from './domain/port/document-number-generator.port';
import { OutboxPort } from './domain/port/outbox.port';
import { ProductLookupPort } from './domain/port/product-lookup.port';
import { PurchaseOrderReadRepositoryPort } from './domain/port/purchase-order-read-repository.port';
import { PurchaseOrderWriteRepositoryPort } from './domain/port/purchase-order-write-repository.port';
import { PurchaseOrganizationConfigurationPort } from './domain/port/purchase-organization-configuration.port';
import { VendorLookupPort } from './domain/port/vendor-lookup.port';
import { PurchaseOrderBuilder } from './domain/service/purchase-order-builder.service';
import { PurchaseOrganizationConfigurationAdapter } from './infrastructure/outbound/configuration/purchase-organization-configuration.adapter';
import { TimestampDocumentNumberGenerator } from './infrastructure/outbound/numbering/document-number-generator.adapter';
import { ProductLookupAdapter } from './infrastructure/outbound/product/product-lookup.adapter';
import { VendorLookupAdapter } from './infrastructure/outbound/vendor/vendor-lookup.adapter';
import { PrismaPurchaseOrderReadRepositoryAdapter } from './infrastructure/persistence/read/purchase-order-read-repository.adapter';
import { PrismaPurchaseOrderWriteRepositoryAdapter } from './infrastructure/persistence/write/purchase-order-write-repository.adapter';
import { PurchaseOrderController } from './presentation/http/controller/purchase-order.controller';
import { PurchaseOrderApprovedIntegrationHandler } from './application/event/purchase-order-approved.handler';

/**
 * Purchase bounded context.
 *
 * Cross-module capabilities (vendor/product/configuration) are reached through
 * purchase-owned domain ports implemented by outbound adapters that resolve
 * the provider modules' application ports via ModulePortAccessor.
 */
@Module({
  controllers: [PurchaseOrderController],
  providers: [
    PurchaseOrderBuilder,
    { provide: VendorLookupPort, useClass: VendorLookupAdapter },
    { provide: ProductLookupPort, useClass: ProductLookupAdapter },
    { provide: PurchaseOrganizationConfigurationPort, useClass: PurchaseOrganizationConfigurationAdapter },
    { provide: DocumentNumberGeneratorPort, useClass: TimestampDocumentNumberGenerator },
    { provide: PurchaseOrderWriteRepositoryPort, useClass: PrismaPurchaseOrderWriteRepositoryAdapter },
    { provide: PurchaseOrderReadRepositoryPort, useClass: PrismaPurchaseOrderReadRepositoryAdapter },
    CreatePurchaseOrderUseCase,
    GetPurchaseOrderUseCase,
    UpdatePurchaseOrderUseCase,
    SubmitPurchaseOrderUseCase,
    ApprovePurchaseOrderUseCase,
    RejectPurchaseOrderUseCase,
    CancelPurchaseOrderUseCase,
    CompletePurchaseOrderUseCase,
    PurchaseOrderLifecycleFacade,
    PurchaseOrderApprovalSaga,
    PurchaseOrderApprovedIntegrationHandler,
    { provide: CreatePurchaseOrderPort, useExisting: CreatePurchaseOrderUseCase },
    { provide: GetPurchaseOrderPort, useExisting: GetPurchaseOrderUseCase },
    { provide: UpdatePurchaseOrderPort, useExisting: UpdatePurchaseOrderUseCase },
    { provide: SubmitPurchaseOrderPort, useExisting: SubmitPurchaseOrderUseCase },
    { provide: ApprovePurchaseOrderPort, useExisting: ApprovePurchaseOrderUseCase },
    { provide: RejectPurchaseOrderPort, useExisting: RejectPurchaseOrderUseCase },
    { provide: CancelPurchaseOrderPort, useExisting: CancelPurchaseOrderUseCase },
    { provide: CompletePurchaseOrderPort, useExisting: CompletePurchaseOrderUseCase },
    { provide: PurchaseOrderLifecyclePort, useExisting: PurchaseOrderLifecycleFacade },
  ],
  exports: [GetPurchaseOrderPort, CreatePurchaseOrderPort, PurchaseOrderLifecyclePort],
})
export class PurchaseModule {}

export { OutboxPort };
