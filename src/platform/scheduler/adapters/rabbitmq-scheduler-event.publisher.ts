import { Inject, Injectable } from '@nestjs/common';
import { MessagePublisher } from '@platform/messaging/ports/message-publisher.port';
import { RabbitMqPublisher } from '@platform/messaging/message-publisher.tokens';
import {
  SchedulerEventPublisherPort,
  SchedulerJobDueEvent,
} from '../ports/scheduler-event-publisher.port';

@Injectable()
export class RabbitMqSchedulerEventPublisher implements SchedulerEventPublisherPort {
  constructor(@Inject(RabbitMqPublisher) private readonly publisher: MessagePublisher) {}

  async publishJobDue(event: SchedulerJobDueEvent): Promise<void> {
    await this.publisher.publish({
      eventType: `scheduler.job.${event.jobType}`,
      aggregateType: event.aggregateType ?? 'ScheduledJob',
      aggregateId: event.aggregateId ?? event.jobId,
      payload: {
        jobId: event.jobId,
        jobType: event.jobType,
        tenantId: event.tenantId,
        scope: event.scope,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        idempotencyKey: event.idempotencyKey,
        priority: event.priority ?? 'normal',
      },
      headers: { idempotencyKey: event.idempotencyKey },
      occurredAt: new Date(),
    });
  }
}
