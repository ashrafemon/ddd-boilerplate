import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MessageQueuePort } from '@platform/messaging/ports/message-queue.port';
import {
  SchedulerEventPublisherPort,
  SchedulerJobDueEvent,
} from '../ports/scheduler-event-publisher.port';

@Injectable()
export class RabbitMqSchedulerEventPublisher implements SchedulerEventPublisherPort {
  constructor(private readonly messageQueue: MessageQueuePort) {}

  async publishJobDue(event: SchedulerJobDueEvent): Promise<void> {
    await this.messageQueue.publish({
      eventId: randomUUID(),
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
      broker: 'rabbitmq',
    });
  }
}
