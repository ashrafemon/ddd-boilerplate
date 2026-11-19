import { Injectable } from '@nestjs/common';
import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { MessageQueuePort } from '../ports/message-queue.port';
import { PublishMessageUseCase } from '../use-cases/publish-message.usecase';

/**
 * Inbound adapter implementing the public `MessageQueuePort`.
 *
 * Delegates to the publish use case and holds no rules of its own; the outbox
 * is its only caller.
 */
@Injectable()
export class MessageQueueAdapter implements MessageQueuePort {
  constructor(private readonly publishMessage: PublishMessageUseCase) {}

  async publish(envelope: OutboxEnvelope): Promise<void> {
    return this.publishMessage.execute(envelope);
  }
}
