import { Injectable } from '@nestjs/common';
import { MessageQueuePort } from '../ports/message-queue.port';
import { MessageQueueNackRequest } from '../message-queue.types';

/**
 * Use case: negatively acknowledge a message (optionally requeue).
 */
@Injectable()
export class RejectMessageUseCase {
  constructor(private readonly messageQueue: MessageQueuePort) {}

  async execute(request: MessageQueueNackRequest): Promise<void> {
    return this.messageQueue.nack(request);
  }
}
