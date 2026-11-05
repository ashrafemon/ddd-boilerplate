import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { InvoiceCommandRepository } from '../../domain/repositories/invoice-command.repository';
import { InvoiceFactory } from '../../domain/factories/invoice.factory';
import { CreateInvoiceRequest } from '../../domain/types/invoice.types';
import { InvoicePublisherPort } from '../integrations/publishes/invoice.publisher-port';
import { NumberingPort } from '../outbound-ports/numbering.port';

const INVOICE_SEQUENCE = 'invoice';

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    private readonly invoiceRepository: InvoiceCommandRepository,
    private readonly integrationEvent: InvoicePublisherPort,
    private readonly numbering: NumberingPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: CreateInvoiceRequest): Promise<string> {
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new Error('Company not found in request context');
    }

    const abacResult = await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: 'Invoice',
      action: 'create',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    if (!input.customerId) {
      throw new ConflictException('customerId is required');
    }
    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new ConflictException('Invoice lines must be a non-empty array');
    }
    const currency = input.currency ?? ctx.defaultCurrency ?? 'USD';
    const invoiceNo = await this.numbering.nextNumber(INVOICE_SEQUENCE, {
      prefix: 'INV-',
      padding: 8,
    });
    const invoice = InvoiceFactory.create({
      invoiceNo,
      customerId: input.customerId,
      currency,
      lines: input.lines,
    });
    await this.invoiceRepository.save(invoice);
    for (const event of invoice.pullEvents()) {
      await this.integrationEvent.send(event, invoice.id.toString());
    }
    return invoice.id.toString();
  }
}
