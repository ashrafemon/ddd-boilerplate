import { Injectable } from '@nestjs/common';
import { MessageQueuePort } from '../ports/message-queue.port';
import { MessageQueueAckRequest } from '../message-queue.types';

/**
 * Use case: acknowledge a successfully processed message.
 */
@Injectable()
export class AcknowledgeMessageUseCase {
  constructor(private readonly messageQueue: MessageQueuePort) {}

  async execute(request: MessageQueueAckRequest): Promise<void> {
    return this.messageQueue.ack(request);
  }
}
