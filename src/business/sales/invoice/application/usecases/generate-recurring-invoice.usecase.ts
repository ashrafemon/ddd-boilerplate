import { Injectable } from '@nestjs/common';
import { RecurringOccurrenceRequestedPayload } from '../integrations/publishes/recurring-occurrence.types';
import { InvoiceGenerationFacade } from '../facades/invoice-generation.facade';

@Injectable()
export class GenerateRecurringInvoiceUseCase {
  constructor(private readonly facade: InvoiceGenerationFacade) {}

  async execute(command: RecurringOccurrenceRequestedPayload): Promise<void> {
    return this.facade.generate(command);
  }
}
