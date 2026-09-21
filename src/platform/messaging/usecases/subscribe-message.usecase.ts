import { Injectable } from '@nestjs/common';
import { MessageQueuePort } from '../ports/message-queue.port';
import { MessageQueueSubscribeRequest, MessageQueueSubscription } from '../message-queue.types';

/**
 * Use case: subscribe to messages on a queue/exchange.
 */
@Injectable()
export class SubscribeMessageUseCase {
  constructor(private readonly messageQueue: MessageQueuePort) {}

  async execute(
    request: MessageQueueSubscribeRequest,
  ): Promise<MessageQueueSubscription> {
    return this.messageQueue.subscribe(request);
  }
}
