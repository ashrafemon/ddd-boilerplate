import { Injectable, Logger } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { SagaTriggerEvent } from '../types/saga.types';
import { SagaEventRouterService } from '../services/saga-event-router.service';

/**
 * Use case: route one delivered event to the sagas it belongs to.
 *
 * Loop guard: the saga's own emitted events (`aggregateType = 'Saga'`) never
 * re-enter, so an `onComplete.emit` that happens to match a start event cannot
 * start another saga. CLS is restored for the duration of the route so
 * `RequestContextPort`-aware adapters see the right tenant/company.
 *
 * Per-definition routing (start/cancel/wait) lives in `SagaEventRouterService`.
 */
@Injectable()
export class AcceptSagaEventUseCase {
  private readonly logger = new Logger(AcceptSagaEventUseCase.name);

  constructor(
    private readonly router: SagaEventRouterService,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(envelope: OutboxEnvelope): Promise<void> {
    if (envelope.aggregateType === 'Saga') {
      return;
    }
    if (!envelope.tenantId || !envelope.companyId) {
      this.logger.warn(`Saga event ${envelope.eventType} has no tenant/company — ignored`);
      return;
    }

    const event: SagaTriggerEvent = {
      eventId: envelope.eventId,
      eventName: envelope.eventType,
      eventVersion: envelope.eventVersion ?? 1,
      tenantId: envelope.tenantId,
      companyId: envelope.companyId,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
      payload: envelope.payload,
    };

    await this.requestContext.run(
      {
        tenantId: event.tenantId,
        companyId: event.companyId,
        correlationId: event.correlationId,
      },
      () => this.router.route(event),
    );
  }
}
