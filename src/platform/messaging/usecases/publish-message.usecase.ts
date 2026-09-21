import { Injectable } from '@nestjs/common';
import { MessageQueuePort } from '../ports/message-queue.port';
import { MessageQueuePublishRequest, MessageQueuePublishResult } from '../message-queue.types';

/**
 * Use case: publish a message to a queue/exchange.
 */
@Injectable()
export class PublishMessageUseCase {
  constructor(private readonly messageQueue: MessageQueuePort) {}

  async execute(
    request: MessageQueuePublishRequest,
  ): Promise<MessageQueuePublishResult> {
    return this.messageQueue.publish(request);
  }
}
