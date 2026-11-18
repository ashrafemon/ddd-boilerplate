import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BrokerSubscription,
  MessageConsumerPort,
} from '@platform/platform-common/messaging/inbound/ports/message-consumer.port';
import {
  fromWireEnvelope,
  WireEnvelope,
} from '@platform/platform-common/messaging/outbound/adapters/envelope.serializer';
import {
  fromResultEnvelope,
  SAGA_STEP_RESULT_QUEUE,
  SAGA_STEP_RESULT_ROUTING_KEY,
} from '../types/saga-command.types';
import { SettleSagaStepResultUseCase } from '../use-cases/settle-saga-step-result.usecase';

const SUBSCRIPTION: BrokerSubscription = {
  routingKey: SAGA_STEP_RESULT_ROUTING_KEY,
  queue: SAGA_STEP_RESULT_QUEUE,
};

/**
 * Consumer of `saga.step.result` — how the saga learns an action finished.
 *
 * Settles the step row (done / reschedule / failed) and lets the plan advance or
 * compensate. A duplicate delivery is harmless: the settle is a CAS on the row
 * status, so only the first result for a `RUNNING` row applies.
 */
@Injectable()
export class SagaStepResultConsumerService implements OnModuleInit {
  private readonly logger = new Logger(SagaStepResultConsumerService.name);

  constructor(
    private readonly settleResult: SettleSagaStepResultUseCase,
    private readonly consumer: MessageConsumerPort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumer.subscribe(SUBSCRIPTION, body => this.onStepResult(body));
  }

  async onStepResult(message: unknown): Promise<void> {
    const envelope = fromWireEnvelope(message);
    const result = envelope ? fromResultEnvelope(envelope.payload) : null;
    if (!result) {
      const wire = message as Partial<WireEnvelope> | null;
      this.logger.warn(`Ignored a non-result delivery (${wire?.eventType ?? '(unknown)'})`);
      return;
    }

    try {
      await this.settleResult.execute(result);
    } catch (err) {
      // A lost result leaves the step RUNNING until its lease expires and the
      // sweep re-dispatches the command — retry lives in the saga, not the queue.
      this.logger.error(
        `Saga step result ${result.stepRowId} could not be settled: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
