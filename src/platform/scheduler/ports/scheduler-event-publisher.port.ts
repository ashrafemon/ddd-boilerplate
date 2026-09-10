export interface SchedulerJobDueEvent {
  jobId: string;
  jobType: string;
  tenantId?: string | null;
  scope: string;
  aggregateType?: string | null;
  aggregateId?: string | null;
  payload?: Record<string, unknown> | null;
  idempotencyKey: string;
  priority?: 'low' | 'normal' | 'high';
}

/** DI token (abstract class port). Implemented by RabbitMqSchedulerEventPublisher. */
export abstract class SchedulerEventPublisherPort {
  abstract publishJobDue(event: SchedulerJobDueEvent): Promise<void>;
}
