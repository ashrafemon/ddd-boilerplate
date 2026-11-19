import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  MessageConsumerPort,
  BrokerSubscription,
} from '@platform/platform-common/messaging/ports/message-consumer.port';
import {
  fromWireEnvelope,
  WireEnvelope,
} from '@platform/platform-common/messaging/adapters/envelope.serializer';
import { SagaInboundPort } from '../ports/saga-inbound.port';

/**
 * Durable queue bound to every routing key — the saga is data-driven, so the
 * binding cannot be a fixed list. The exchange is chosen by the messaging module.
 */
export const SAGA_EVENT_QUEUE = 'saga.all-events.erp';

const SUBSCRIPTION: BrokerSubscription = { routingKey: '#', queue: SAGA_EVENT_QUEUE };

/** Delivered event → saga router. */
@Injectable()
export class SagaBrokerConsumerService implements OnModuleInit {
  private readonly logger = new Logger(SagaBrokerConsumerService.name);

  constructor(
    private readonly saga: SagaInboundPort,
    private readonly consumer: MessageConsumerPort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumer.subscribe(SUBSCRIPTION, body => this.onDomainEvent(body));
  }

  /**
   * Trigger edge: broker → `SagaInboundPort.accept`.
   *
   * The binding is `#` on the topic exchange, because which events matter is
   * decided by rows in `saga_definitions`, not by code — a per-event binding
   * would have to be redeployed for every new saga. The router decides what each
   * envelope does (start, feed a WAIT step, cancel) and ignores the rest.
   *
   * Delivery is at-least-once: the message is acked only after `accept`
   * returned, and duplicates are absorbed by the saga's own dedupe
   * (`live_key` for starts, `saga_inbox` unique per delivery for WAIT steps).
   * A failure is logged and acked rather than requeued forever — with no DLX
   * configured, requeueing a poison message would spin; the outbox on the
   * producer side remains the retry path.
   */
  async onDomainEvent(message: unknown): Promise<void> {
    const envelope = fromWireEnvelope(message);
    if (!envelope) {
      const body = message as Partial<WireEnvelope> | null;
      this.logger.warn(`Ignored a non-envelope delivery on ${body?.eventType ?? '(unknown)'}`);
      return;
    }
    if (!envelope.tenantId || !envelope.companyId) {
      this.logger.warn(`Saga event ${envelope.eventType} has no tenant/company — ignored`);
      return;
    }

    try {
      await this.saga.accept(envelope);
    } catch (err) {
      this.logger.error(
        `Saga trigger failed for ${envelope.eventType} (${envelope.eventId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
