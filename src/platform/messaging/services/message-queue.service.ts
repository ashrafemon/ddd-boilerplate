import { Injectable } from '@nestjs/common';
import { OutboxEnvelope } from '@platform/outbox/outbox.types';
import { MessageQueuePort } from '../ports/message-queue.port';
import { PublishMessageUseCase } from '../usecases/publish-message.usecase';

/**
 * Message Queue service facade — implements the public `MessageQueuePort`.
 * Delegates to the publish use case; holds no rules of its own.
 */
@Injectable()
export class MessageQueueService implements MessageQueuePort {
  constructor(private readonly publishMessage: PublishMessageUseCase) {}

  async publish(envelope: OutboxEnvelope): Promise<void> {
    return this.publishMessage.execute(envelope);
  }
}
