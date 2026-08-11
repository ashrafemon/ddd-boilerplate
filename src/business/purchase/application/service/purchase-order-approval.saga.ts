import { Injectable } from '@nestjs/common';
import { EmailPort } from '../../../../shared-kernel/ports/notification/email.port';
import { NotificationPort } from '../../../../shared-kernel/ports/notification/notification.port';
import { SagaDefinition } from '../../../../platform/saga/saga-definition';
import { SagaExecutor } from '../../../../platform/saga/saga-executor.service';
import { RequestContextPort } from '../../../../shared-kernel/ports/context/request-context.port';
import { LoggerPort } from '../../../../shared-kernel/ports/observability/logger.port';
import { MetricsPort } from '../../../../shared-kernel/ports/observability/metrics.port';

export interface PurchaseOrderApprovalState {
  correlationId: string;
  purchaseOrderId: string;
  number?: string;
  tenantId: string;
  organizationId: string;
}

/**
 * Post-approval saga for a purchase order.
 *
 * Demonstrates the Saga infrastructure: steps with retry and compensation.
 * In a full ERP this saga would call the InventoryModule and AccountingModule
 * through their application ports (via ModulePortAccessor); here the steps use
 * real notification/email ports so the machinery is exercised end to end.
 */
@Injectable()
export class PurchaseOrderApprovalSaga {
  constructor(
    private readonly sagaExecutor: SagaExecutor,
    private readonly notificationPort: NotificationPort,
    private readonly emailPort: EmailPort,
    private readonly requestContext: RequestContextPort,
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
  ) {}

  public async run(state: Omit<PurchaseOrderApprovalState, 'correlationId'>): Promise<void> {
    const fullState: PurchaseOrderApprovalState = {
      ...state,
      correlationId: this.requestContext.getCorrelationId() ?? state.purchaseOrderId,
    };
    const definition = new SagaDefinition<PurchaseOrderApprovalState>(
      'purchase-order-approval',
      [
        {
          name: 'record-approval-metric',
          maxAttempts: 2,
          invoke: () => {
            this.metrics.incrementCounter('erp_purchase_order_approvals_total', { status: 'approved' });
          },
        },
        {
          name: 'notify-purchasing-team',
          maxAttempts: 3,
          backoffMs: 500,
          invoke: (current) =>
            this.notificationPort.send({
              subject: `Purchase order ${current.number} approved`,
              body: `Purchase order ${current.number} was approved for ${current.organizationId}.`,
              correlationId: current.correlationId,
              tenantId: current.tenantId,
              organizationId: current.organizationId,
              channels: [{ channel: 'email', recipient: 'purchasing@erp.local' }],
            }),
          compensate: (current) =>
            this.notificationPort.send({
              subject: `Purchase order ${current.number} approval rolled back`,
              body: 'A step of the approval saga failed; compensation was executed.',
              correlationId: current.correlationId,
              tenantId: current.tenantId,
              organizationId: current.organizationId,
              channels: [{ channel: 'email', recipient: 'purchasing@erp.local' }],
            }),
        },
        {
          name: 'send-vendor-order-confirmation',
          maxAttempts: 2,
          invoke: (current) =>
            this.emailPort.send({
              to: `vendor-${current.purchaseOrderId}@erp.local`,
              subject: `Order confirmation ${current.number}`,
              text: `Your purchase order ${current.number} has been approved.`,
              correlationId: current.correlationId,
              tenantId: current.tenantId,
              organizationId: current.organizationId,
            }),
        },
      ],
    );

    this.logger.info('purchase-order-approval-saga-started', {
      purchaseOrderId: fullState.purchaseOrderId,
      correlationId: fullState.correlationId,
    });

    await this.sagaExecutor.run(definition, fullState);
  }
}
