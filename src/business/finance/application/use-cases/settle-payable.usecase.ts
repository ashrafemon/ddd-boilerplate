import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import { Payment } from '../../domain/entities/payment.entity';
import { PaymentRepository } from '../../domain/repositories/finance.repository';
import { FinancePublisherPort } from '../publishes/publishers/finance.publisher-port';
import { SettlePayableInput } from '../../domain/types/finance.types';

@Injectable()
export class SettlePayableUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly integrationEvent: FinancePublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
    private readonly audit: AuditPort,
  ) {}

  @Transactional()
  async execute(input: SettlePayableInput): Promise<string> {
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new NotFoundException('Company not found in request context');
    }

    await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: 'Payment',
      action: 'settle',
    });

    const actorId = ctx.userId ?? '';

    const payment = Payment.create({
      paymentNo: input.paymentAmount.toString(),
      amount: input.paymentAmount,
      currency: input.currency,
      companyId,
      tenantId: ctx.tenantId ?? null,
    });

    payment.complete();

    await this.paymentRepository.save(payment);

    await this.audit.record({
      action: 'finance.settle-payable',
      entityType: 'Payment',
      entityId: payment.id,
      actorId,
      tenantId: ctx.tenantId,
      companyId: this.requestContext.getCompanyId(),
      changes: { amount: payment.amount, currency: payment.currency, status: payment.status },
    });

    return payment.id;
  }
}
