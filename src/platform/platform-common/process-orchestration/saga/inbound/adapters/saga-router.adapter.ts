import { Injectable } from '@nestjs/common';
import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { AcceptSagaEventUseCase } from '../../use-cases/accept-saga-event.usecase';
import { SagaInboundPort } from '../ports/saga-inbound.port';

/**
 * Inbound adapter implementing `SagaInboundPort`.
 *
 * Any broker consumer or business listener that holds a canonical `OutboxEnvelope`
 * calls `accept`; the routing decisions live in `AcceptSagaEventUseCase`, so this
 * class carries no rules of its own.
 */
@Injectable()
export class SagaRouterAdapter implements SagaInboundPort {
  constructor(private readonly acceptEvent: AcceptSagaEventUseCase) {}

  accept(envelope: OutboxEnvelope): Promise<void> {
    return this.acceptEvent.execute(envelope);
  }
}
