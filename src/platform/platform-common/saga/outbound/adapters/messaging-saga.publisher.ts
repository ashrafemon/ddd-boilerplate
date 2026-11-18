import { Injectable } from '@nestjs/common';
import { MessageQueuePort } from '@platform/platform-common/messaging/inbound/ports/message-queue.port';
import {
  SagaStepCommand,
  SagaStepResult,
  toCommandEnvelope,
  toResultEnvelope,
} from '../../types/saga-command.types';
import { SagaCommandPublisherPort, SagaStepResultPublisherPort } from '../ports/saga-command.port';

/**
 * Platform-transport adapter for both saga publishing ports.
 *
 * The saga owns no broker client. Commands and results leave through
 * `MessageQueuePort` — the same port the outbox uses — so routing
 * (`envelope.broker`, topic exchange, `eventType` as routing key) and any future
 * transport change are decided in one place, by the messaging module.
 *
 * The envelope's `eventType` *is* the routing key: `saga.command` and
 * `saga.step.result`, which the two saga consumers bind to.
 */
@Injectable()
export class MessagingSagaPublisher
  implements SagaCommandPublisherPort, SagaStepResultPublisherPort
{
  constructor(private readonly messages: MessageQueuePort) {}

  async dispatch(command: SagaStepCommand): Promise<void> {
    await this.messages.publish({ ...toCommandEnvelope(command), broker: 'rabbitmq' });
  }

  async publish(result: SagaStepResult): Promise<void> {
    await this.messages.publish({ ...toResultEnvelope(result), broker: 'rabbitmq' });
  }
}
