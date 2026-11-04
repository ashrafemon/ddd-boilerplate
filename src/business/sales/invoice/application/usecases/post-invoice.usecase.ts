import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { InvoiceCommandRepository } from '../../domain/repositories/invoice-command.repository';
import { InvoicePublisherPort } from '../integrations/publishes/invoice.publisher-port';

@Injectable()
export class PostInvoiceUseCase {
  constructor(
    private readonly invoiceRepository: InvoiceCommandRepository,
    private readonly integrationEvent: InvoicePublisherPort,
  ) {}

  @Transactional()
  async execute(id: string): Promise<string> {
    const invoice = await this.invoiceRepository.findById(id);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    invoice.post();
    await this.invoiceRepository.update(invoice);
    for (const event of invoice.pullEvents()) {
      await this.integrationEvent.send(event, invoice.id.toString());
    }
    return invoice.id.toString();
  }
}
