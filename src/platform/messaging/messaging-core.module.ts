import { Global, Module } from '@nestjs/common';
import { CompositeMessagePublisher } from './composite-message-publisher';
import { IntegrationMessageProcessor } from './integration-message-processor.service';
import { IntegrationMessageRouter } from './integration-message-router';
import { MessagePublisherPort } from '../../shared-kernel/ports/messaging/message-publisher.port';

/**
 * Core messaging providers shared by all transports: the composite publisher,
 * the message router and the shared processing pipeline.
 */
@Global()
@Module({
  imports: [],
  providers: [
    IntegrationMessageRouter,
    IntegrationMessageProcessor,
    { provide: MessagePublisherPort, useClass: CompositeMessagePublisher },
    CompositeMessagePublisher,
  ],
  exports: [
    IntegrationMessageRouter,
    IntegrationMessageProcessor,
    MessagePublisherPort,
    CompositeMessagePublisher,
  ],
})
export class MessagingCoreModule {}
