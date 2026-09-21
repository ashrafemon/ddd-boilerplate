import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module';
import { MessageQueuePort } from './ports/message-queue.port';
import { MessageQueueService } from './message-queue.service';
import { MessageConsumerRegistry } from './consumers/message-consumer.registry';
import { PublishMessageUseCase } from './usecases/publish-message.usecase';
import { SubscribeMessageUseCase } from './usecases/subscribe-message.usecase';
import { AcknowledgeMessageUseCase } from './usecases/acknowledge-message.usecase';
import { RejectMessageUseCase } from './usecases/reject-message.usecase';

/**
 * Platform Message Queue module — infrastructure-agnostic async message
 * transport boundary for RabbitMQ, Kafka, SQS, and future providers.
 *
 * Business modules never call RabbitMQ/Kafka directly.
 * The Outbox Dispatcher publishes through MessageQueuePort.
 *
 * This module is NOT global. Business modules must import PlatformModule.
 */
@Module({
  imports: [ContextModule],
  providers: [
    // Consumer registry
    MessageConsumerRegistry,

    // Use cases
    PublishMessageUseCase,
    SubscribeMessageUseCase,
    AcknowledgeMessageUseCase,
    RejectMessageUseCase,

    // Facade → public port
    MessageQueueService,
    { provide: MessageQueuePort, useExisting: MessageQueueService },
  ],
  exports: [MessageQueuePort, MessageConsumerRegistry],
})
export class MessageQueueModule {}
