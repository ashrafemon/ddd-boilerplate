import { CreateRecurringTemplateInput, RecurringTemplateRecord } from '../recurring-template.types';

export interface RecurringTemplateUpdate {
  status?: RecurringTemplateRecord['status'];
  nextRunDate?: Date | null;
  lastRunDate?: Date | null;
  modifiedBy?: string;
}

/**
 * Owned by RecurringModule — SchedulerModule/ConditionEngineModule never
 * reference `recurring_templates`. Implemented by a Prisma adapter that goes
 * through TransactionHost so writes participate in the caller's
 * @Transactional boundary (e.g. the first scheduled_jobs row and the
 * template row committing atomically).
 */
export abstract class RecurringTemplateRepositoryPort {
  abstract create(input: CreateRecurringTemplateInput): Promise<RecurringTemplateRecord>;
  abstract findById(id: string): Promise<RecurringTemplateRecord | null>;
  abstract update(id: string, patch: RecurringTemplateUpdate): Promise<RecurringTemplateRecord>;
  abstract list(filter: {
    tenantId?: string;
    status?: RecurringTemplateRecord['status'];
  }): Promise<RecurringTemplateRecord[]>;
  /** Active EVENT templates matching an event name — DomainEventDispatcher's lookup. */
  abstract findActiveByEventName(
    eventName: string,
    tenantId?: string,
  ): Promise<RecurringTemplateRecord[]>;
}
