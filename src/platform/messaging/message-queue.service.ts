import { Injectable } from '@nestjs/common';
import { MessageQueuePort } from './ports/message-queue.port';
import {
  MessageQueuePublishRequest,
  MessageQueuePublishResult,
  MessageQueueSubscribeRequest,
  MessageQueueSubscription,
  MessageQueueAckRequest,
  MessageQueueNackRequest,
} from './message-queue.types';
import { PublishMessageUseCase } from './usecases/publish-message.usecase';
import { SubscribeMessageUseCase } from './usecases/subscribe-message.usecase';
import { AcknowledgeMessageUseCase } from './usecases/acknowledge-message.usecase';
import { RejectMessageUseCase } from './usecases/reject-message.usecase';

/**
 * Message Queue service facade — the single entry point for all MQ operations.
 *
 * Delegates to individual use cases (one per file) without containing
 * business rules itself. This class implements the public MessageQueuePort.
 */
@Injectable()
export class MessageQueueService implements MessageQueuePort {
  constructor(
    private readonly publishMessage: PublishMessageUseCase,
    private readonly subscribeMessage: SubscribeMessageUseCase,
    private readonly acknowledgeMessage: AcknowledgeMessageUseCase,
    private readonly rejectMessage: RejectMessageUseCase,
  ) {}

  async publish(
    request: MessageQueuePublishRequest,
  ): Promise<MessageQueuePublishResult> {
    return this.publishMessage.execute(request);
  }

  async subscribe(
    request: MessageQueueSubscribeRequest,
  ): Promise<MessageQueueSubscription> {
    return this.subscribeMessage.execute(request);
  }

  async ack(request: MessageQueueAckRequest): Promise<void> {
    return this.acknowledgeMessage.execute(request);
  }

  async nack(request: MessageQueueNackRequest): Promise<void> {
    return this.rejectMessage.execute(request);
  }
}
