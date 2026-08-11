import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '../../../../shared-kernel/ports/context/request-context.port';
import { ApprovePurchaseOrderUseCase } from '../use-case/approve-purchase-order/approve-purchase-order.use-case';
import { ApprovePurchaseOrderInput, ApprovePurchaseOrderOutput } from '../port/approve-purchase-order.port';
import { PurchaseOrderLifecyclePort } from '../port/purchase-order-lifecycle.port';
import { PurchaseOrderApprovalSaga } from '../service/purchase-order-approval.saga';

/**
 * Facade orchestrating the purchase order lifecycle across use cases and
 * platform capabilities (saga orchestration after approval).
 */
@Injectable()
export class PurchaseOrderLifecycleFacade implements PurchaseOrderLifecyclePort {
  constructor(
    private readonly approvePurchaseOrderUseCase: ApprovePurchaseOrderUseCase,
    private readonly approvalSaga: PurchaseOrderApprovalSaga,
    private readonly requestContext: RequestContextPort,
  ) {}

  public async approveAndRunPostProcessing(
    input: ApprovePurchaseOrderInput,
  ): Promise<ApprovePurchaseOrderOutput> {
    const result = await this.approvePurchaseOrderUseCase.execute(input);

    if (result.status === 'APPROVED') {
      await this.approvalSaga.run({
        purchaseOrderId: result.purchaseOrderId,
        tenantId: this.requestContext.getTenantId() ?? '',
        organizationId: this.requestContext.getOrganizationId() ?? '',
      });
    }

    return result;
  }
}
