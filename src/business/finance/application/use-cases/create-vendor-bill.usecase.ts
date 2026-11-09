import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import { VendorBill } from '../../domain/entities/vendor-bill.entity';
import { VendorBillRepository } from '../../domain/repositories/finance.repository';
import { FinancePublisherPort } from '../publishes/publishers/finance.publisher-port';
import { CreateVendorBillInput } from '../../domain/types/finance.types';

@Injectable()
export class CreateVendorBillUseCase {
  constructor(
    private readonly vendorBillRepository: VendorBillRepository,
    private readonly integrationEvent: FinancePublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
    private readonly audit: AuditPort,
  ) {}

  @Transactional()
  async execute(input: CreateVendorBillInput): Promise<string> {
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
      resource: 'VendorBill',
      action: 'create',
    });

    const actorId = ctx.userId ?? '';

    const bill = VendorBill.create({
      billNo: input.billNo,
      vendorId: input.vendorId,
      amount: input.amount,
      currency: input.currency,
      dueDate: input.dueDate,
      companyId,
      tenantId: ctx.tenantId ?? null,
    });

    await this.vendorBillRepository.save(bill);

    await this.audit.record({
      action: 'finance.create-vendor-bill',
      entityType: 'VendorBill',
      entityId: bill.id,
      actorId,
      tenantId: ctx.tenantId,
      companyId: this.requestContext.getCompanyId(),
      changes: { billNo: bill.billNo, amount: bill.amount, currency: bill.currency },
    });

    return bill.id;
  }
}
