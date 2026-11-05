import { CreateRecurringTemplateInput, RecurringTemplateRecord } from '../recurring-template.types';

/**
 * Cross-module inbound port — the stable public surface for creating recurring
 * templates from business modules (e.g. PurchaseOrder "make this PO
 * recurring"). Implemented by RecurringTemplateAdapter over
 * CreateRecurringTemplateUseCase; business code injects this port, never the
 * use case. Only operations with real external consumers appear here — ops
 * methods join on demand, mirroring the SchedulerPort facade rule.
 */
export abstract class RecurringTemplatePort {
  abstract create(input: CreateRecurringTemplateInput): Promise<RecurringTemplateRecord>;
}
