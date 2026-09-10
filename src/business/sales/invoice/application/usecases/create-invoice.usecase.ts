import { ConflictException, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { InvoiceCommandRepository } from '../../domain/repositories/invoice-command.repository';
import { InvoiceFactory } from '../../domain/factories/invoice.factory';
import { CreateInvoiceRequest } from '../../domain/types/invoice.types';
import { InvoiceId } from '../../domain/value-objects/invoice-id.vo';
import { InvoiceIntegrationPort } from '../integrations/publishes/invoice.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';
import { NumberingPort } from '../outbound-ports/numbering.port';

const INVOICE_SEQUENCE = 'invoice';

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    private readonly invoiceRepository: InvoiceCommandRepository,
    private readonly integrationEvent: InvoiceIntegrationPort,
    private readonly companyConfig: CompanyConfigPort,
    private readonly numbering: NumberingPort,
  ) {}

  @Transactional()
  async execute(input: CreateInvoiceRequest): Promise<InvoiceId> {
    if (!input.customerId) {
      throw new ConflictException('customerId is required');
    }
    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new ConflictException('Invoice lines must be a non-empty array');
    }
    const company = await this.companyConfig.getCompanyConfig();
    const currency = input.currency ?? company.defaultCurrency;
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
    return invoice.id;
  }
}
