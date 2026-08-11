import { PurchaseOrderLifecycleFacade } from '../../src/business/purchase/application/facade/purchase-order-lifecycle.facade';
import { ApprovePurchaseOrderUseCase } from '../../src/business/purchase/application/use-case/approve-purchase-order/approve-purchase-order.use-case';
import { PurchaseOrderApprovalSaga } from '../../src/business/purchase/application/service/purchase-order-approval.saga';
import { RequestContextPort } from '../../src/shared-kernel/ports/context/request-context.port';

describe('PurchaseOrderLifecycleFacade', () => {
  const requestContext: RequestContextPort = {
    isAvailable: () => true,
    get: () => null,
    require: () => {
      throw new Error('not used');
    },
    set: () => undefined,
    getRequestId: () => undefined,
    getCorrelationId: () => 'corr-facade',
    getTenantId: () => 'tenant-1',
    getOrganizationId: () => 'org-1',
    getUserId: () => 'user-1',
  };

  it('approves the order and runs the post-approval saga', async () => {
    const approveUseCase = {
      execute: jest.fn().mockResolvedValue({
        purchaseOrderId: 'po-1',
        status: 'APPROVED',
        requiresAdditionalApproval: false,
      }),
    } as unknown as ApprovePurchaseOrderUseCase;

    const approvalSaga = {
      run: jest.fn().mockResolvedValue(undefined),
    } as unknown as PurchaseOrderApprovalSaga;

    const facade = new PurchaseOrderLifecycleFacade(approveUseCase, approvalSaga, requestContext);

    const result = await facade.approveAndRunPostProcessing({
      purchaseOrderId: 'po-1',
      approvedByUserId: 'user-1',
    });

    expect(result.status).toBe('APPROVED');
    expect(approvalSaga.run).toHaveBeenCalledTimes(1);
    expect(approvalSaga.run).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseOrderId: 'po-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
      }),
    );
  });

  it('does not run the saga when approval is not granted', async () => {
    const approveUseCase = {
      execute: jest.fn().mockResolvedValue({
        purchaseOrderId: 'po-1',
        status: 'SUBMITTED',
        requiresAdditionalApproval: true,
      }),
    } as unknown as ApprovePurchaseOrderUseCase;

    const approvalSaga = {
      run: jest.fn(),
    } as unknown as PurchaseOrderApprovalSaga;

    const facade = new PurchaseOrderLifecycleFacade(approveUseCase, approvalSaga, requestContext);

    await facade.approveAndRunPostProcessing({ purchaseOrderId: 'po-1' });

    expect(approvalSaga.run).not.toHaveBeenCalled();
  });
});
