import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BrokerSubscription,
  MessageConsumerPort,
} from '@platform/platform-common/messaging/ports/message-consumer.port';
import {
  fromWireEnvelope,
  WireEnvelope,
} from '@platform/platform-common/messaging/adapters/envelope.serializer';
import {
  fromCommandEnvelope,
  SAGA_COMMAND_QUEUE,
  SAGA_COMMAND_ROUTING_KEY,
} from '../types/saga-command.types';
import { RunSagaStepCommandUseCase } from '../use-cases/run-saga-step-command.usecase';

export const SAGA_COMMAND_CONSUMER_QUEUE = SAGA_COMMAND_QUEUE;

const SUBSCRIPTION: BrokerSubscription = {
  routingKey: SAGA_COMMAND_ROUTING_KEY,
  queue: SAGA_COMMAND_QUEUE,
};

/**
 * Consumer of `saga.command` — the only place a saga action is executed.
 *
 * The saga publishes the command; this consumer resolves the `SAGA_ACTION`,
 * runs it inside the tenant's request context and publishes `saga.step.result`.
 * Nothing in the request path of the triggering event calls business work.
 *
 * Ack-after-run gives at-least-once execution; `idempotencyKey` (the step row id)
 * is what makes a redelivery safe.
 */
@Injectable()
export class SagaCommandConsumerService implements OnModuleInit {
  private readonly logger = new Logger(SagaCommandConsumerService.name);

  constructor(
    private readonly runCommand: RunSagaStepCommandUseCase,
    private readonly consumer: MessageConsumerPort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumer.subscribe(SUBSCRIPTION, body => this.onCommand(body));
  }

  async onCommand(message: unknown): Promise<void> {
    const envelope = fromWireEnvelope(message);
    const command = envelope ? fromCommandEnvelope(envelope.payload) : null;
    if (!command) {
      const wire = message as Partial<WireEnvelope> | null;
      this.logger.warn(`Ignored a non-command delivery (${wire?.eventType ?? '(unknown)'})`);
      return;
    }

    try {
      await this.runCommand.execute(command);
    } catch (err) {
      // The step row stays RUNNING; its lease expires and the sweep re-dispatches,
      // so a consumer crash is retried by the saga, not by the broker loop.
      this.logger.error(
        `Saga command ${command.action} (${command.stepRowId}) failed to run: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
