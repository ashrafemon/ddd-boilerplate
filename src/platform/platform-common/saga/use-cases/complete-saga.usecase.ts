import { Injectable } from '@nestjs/common';
import { OutboxWriterPort } from '@platform/platform-common/outbox/inbound/ports/outbox-writer.port';
import { SagaEmittedEvent } from '../types/saga-emitted.event';
import { SagaInstanceRecord, SagaInstanceStatus } from '../types/saga.types';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';

/**
 * Use case: finish an instance whose plan cursor walked past the last step.
 *
 * Completion is a terminal CAS (which also releases the live unique key). The
 * optional `onComplete.emit` event rides the normal outbox inside the caller's
 * transaction, so "saga completed" and "the downstream event exists" cannot
 * disagree.
 */
@Injectable()
export class CompleteSagaUseCase {
  constructor(
    private readonly instances: SagaInstanceRepositoryPort,
    private readonly outbox: OutboxWriterPort,
  ) {}

  async execute(instance: SagaInstanceRecord, cursor: number): Promise<SagaInstanceRecord | null> {
    const updated = await this.instances.updateCas(instance.id, instance.version, {
      status: SagaInstanceStatus.COMPLETED,
      cursor,
      waitingEvent: null,
    });
    if (updated && instance.plan.onComplete) {
      await this.outbox.append(
        new SagaEmittedEvent(instance.plan.onComplete.emit, {
          sagaKey: instance.sagaKey,
          instanceId: instance.id,
          correlationKey: instance.correlationKey,
        }),
        'Saga',
        instance.id,
      );
    }
    return updated;
  }
}
