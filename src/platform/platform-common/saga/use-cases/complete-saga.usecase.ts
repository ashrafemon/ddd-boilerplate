import { Injectable } from '@nestjs/common';
import { SagaEmittedEvent } from '../types/saga-emitted.event';
import { SagaInstanceRecord, SagaInstanceStatus } from '../types/saga.types';
import { PrismaSagaInstanceRepository } from '../repositories/prisma-saga-instance.repository';
import { SagaOutboxWriterPort } from '@platform/platform-common/saga-outbox/ports/saga-outbox-writer.port';

/**
 * Use case: finish an instance whose plan cursor walked past the last step.
 *
 * Completion is a terminal CAS (which also releases the live unique key). The
 * optional `onComplete.emit` event is appended to `saga_outbox` inside the
 * caller's transaction, so "saga completed" and "the downstream event exists"
 * cannot disagree. The saga dispatcher publishes it afterwards.
 */
@Injectable()
export class CompleteSagaUseCase {
  constructor(
    private readonly instances: PrismaSagaInstanceRepository,
    private readonly outbox: SagaOutboxWriterPort,
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
