import { Injectable } from '@nestjs/common';
import { RecurringOccurrenceRequestedPayload } from '../integrations/publishes/recurring-occurrence.types';
import { PurchaseOrderGenerationFacade } from '../facades/purchase-order-generation.facade';

@Injectable()
export class GenerateRecurringPurchaseOrderUseCase {
  constructor(private readonly facade: PurchaseOrderGenerationFacade) {}

  async execute(command: RecurringOccurrenceRequestedPayload): Promise<void> {
    return this.facade.generate(command);
  }
}
