import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ContextModule } from '@platform/context/context.module';
import { IdempotencyModule } from '@platform/idempotency/idempotency.module';
import { OutboxModule } from '@platform/outbox/outbox.module';
import { WebhookEventTypeRegistry } from './webhook-event-type.registry';
import { WebhookInboundSourceRegistry } from './webhook-inbound-source.registry';
import { WebhookDispatchDispatcher } from './webhook-dispatch.dispatcher';
import { WebhookReconciliation } from './webhook-reconciliation';
import { WEBHOOK_QUEUE_NAME } from './webhook.constants';
import { WebhookDeliveryRepositoryPort } from './ports/webhook-delivery-repository.port';
import { WebhookQueuePublisherPort } from './ports/webhook-queue-publisher.port';
import { WebhookSubscriptionRepositoryPort } from './ports/webhook-subscription-repository.port';
import { WebhookTransportPort } from './ports/webhook-transport.port';
import { CreateWebhookSubscriptionUseCase } from './usecases/create-webhook-subscription.usecase';
import { DeleteWebhookSubscriptionUseCase } from './usecases/delete-webhook-subscription.usecase';
import { DeliverWebhookUseCase } from './usecases/deliver-webhook.usecase';
import { DispatchWebhookEventUseCase } from './usecases/dispatch-webhook-event.usecase';
import { GetWebhookSubscriptionUseCase } from './usecases/get-webhook-subscription.usecase';
import { ListWebhookDeliveriesUseCase } from './usecases/list-webhook-deliveries.usecase';
import { ListWebhookSubscriptionsUseCase } from './usecases/list-webhook-subscriptions.usecase';
import { MarkWebhookDeliveryExhaustedUseCase } from './usecases/mark-webhook-delivery-exhausted.usecase';
import { ReceiveInboundWebhookUseCase } from './usecases/receive-inbound-webhook.usecase';
import { RedeliverWebhookUseCase } from './usecases/redeliver-webhook.usecase';
import { UpdateWebhookSubscriptionUseCase } from './usecases/update-webhook-subscription.usecase';
import { BullMqWebhookQueueAdapter } from './adapters/bullmq-webhook-queue.adapter';
import { BullMqWebhookWorker } from './adapters/bullmq-webhook.worker';
import { HttpWebhookTransportAdapter } from './adapters/http-webhook-transport.adapter';
import { PrismaWebhookDeliveryRepository } from './repositories/prisma-webhook-delivery.repository';
import { PrismaWebhookSubscriptionRepository } from './repositories/prisma-webhook-subscription.repository';
import { WebhookController } from './http/webhook.controller';

/**
 * Platform webhook — inbound receipt (generic, per-source) + outbound
 * subscription/dispatch/retry. Distinct from notification's own inbound
 * delivery-receipt webhook, which stays notification's concern untouched.
 * Outbound eventTypes and inbound sources are both opt-in registries
 * populated at boot by the composition root
 * (src/bootstrap/configure-webhooks.ts) — same precedent as
 * configure-notifications.ts. Both start empty; this ships the full
 * capability ahead of any consumer (PLATFORM-SERVICE-GUIDE §6).
 */
@Module({
  imports: [
    ContextModule,
    OutboxModule,
    IdempotencyModule,
    BullModule.registerQueue({ name: WEBHOOK_QUEUE_NAME }),
  ],
  controllers: [WebhookController],
  providers: [
    WebhookEventTypeRegistry,
    WebhookInboundSourceRegistry,
    PrismaWebhookSubscriptionRepository,
    {
      provide: WebhookSubscriptionRepositoryPort,
      useExisting: PrismaWebhookSubscriptionRepository,
    },
    PrismaWebhookDeliveryRepository,
    { provide: WebhookDeliveryRepositoryPort, useExisting: PrismaWebhookDeliveryRepository },
    BullMqWebhookQueueAdapter,
    { provide: WebhookQueuePublisherPort, useExisting: BullMqWebhookQueueAdapter },
    HttpWebhookTransportAdapter,
    { provide: WebhookTransportPort, useExisting: HttpWebhookTransportAdapter },
    BullMqWebhookWorker,
    WebhookDispatchDispatcher,
    WebhookReconciliation,
    CreateWebhookSubscriptionUseCase,
    UpdateWebhookSubscriptionUseCase,
    DeleteWebhookSubscriptionUseCase,
    GetWebhookSubscriptionUseCase,
    ListWebhookSubscriptionsUseCase,
    DispatchWebhookEventUseCase,
    DeliverWebhookUseCase,
    MarkWebhookDeliveryExhaustedUseCase,
    ListWebhookDeliveriesUseCase,
    RedeliverWebhookUseCase,
    ReceiveInboundWebhookUseCase,
  ],
  exports: [WebhookEventTypeRegistry, WebhookInboundSourceRegistry],
})
export class WebhookModule {}
