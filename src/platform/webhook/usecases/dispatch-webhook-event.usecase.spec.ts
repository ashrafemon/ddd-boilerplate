import { WebhookQueuePublisherPort } from '../ports/webhook-queue-publisher.port';
import { InMemoryWebhookDeliveryRepository } from '../__testing__/in-memory-webhook-delivery.repository';
import { InMemoryWebhookSubscriptionRepository } from '../__testing__/in-memory-webhook-subscription.repository';
import { DispatchWebhookEventUseCase } from './dispatch-webhook-event.usecase';

class StubQueuePublisher implements WebhookQueuePublisherPort {
  enqueued: string[] = [];
  enqueueDelivery(deliveryId: string): Promise<void> {
    this.enqueued.push(deliveryId);
    return Promise.resolve();
  }
}

describe('DispatchWebhookEventUseCase', () => {
  it('creates one delivery per ACTIVE subscription declaring the eventType and enqueues each', async () => {
    const subscriptions = new InMemoryWebhookSubscriptionRepository();
    const deliveries = new InMemoryWebhookDeliveryRepository();
    const queuePublisher = new StubQueuePublisher();
    const useCase = new DispatchWebhookEventUseCase(subscriptions, deliveries, queuePublisher);

    const subscription = await subscriptions.create({
      tenantId: null,
      url: 'https://example.com/hook',
      secret: 'a-very-long-shared-secret',
      eventTypes: ['PurchaseOrderApproved'],
    });

    await useCase.execute('PurchaseOrderApproved', 'event-1', { orderId: 'po-1' });

    const page = await deliveries.list({ subscriptionId: subscription.id, page: 1, pageSize: 10 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].eventId).toBe('event-1');
    expect(queuePublisher.enqueued).toEqual([page.items[0].id]);
  });

  it('is idempotent on (subscriptionId, eventId) — a re-delivered event does not double-create', async () => {
    const subscriptions = new InMemoryWebhookSubscriptionRepository();
    const deliveries = new InMemoryWebhookDeliveryRepository();
    const queuePublisher = new StubQueuePublisher();
    const useCase = new DispatchWebhookEventUseCase(subscriptions, deliveries, queuePublisher);

    const subscription = await subscriptions.create({
      tenantId: null,
      url: 'https://example.com/hook',
      secret: 'a-very-long-shared-secret',
      eventTypes: ['PurchaseOrderApproved'],
    });

    await useCase.execute('PurchaseOrderApproved', 'event-1', { orderId: 'po-1' });
    await useCase.execute('PurchaseOrderApproved', 'event-1', { orderId: 'po-1' });

    const page = await deliveries.list({ subscriptionId: subscription.id, page: 1, pageSize: 10 });
    expect(page.items).toHaveLength(1);
    // The second call found nothing new to create, so nothing new to enqueue.
    expect(queuePublisher.enqueued).toHaveLength(1);
  });

  it('does nothing when no ACTIVE subscription declares the eventType', async () => {
    const subscriptions = new InMemoryWebhookSubscriptionRepository();
    const deliveries = new InMemoryWebhookDeliveryRepository();
    const queuePublisher = new StubQueuePublisher();
    const useCase = new DispatchWebhookEventUseCase(subscriptions, deliveries, queuePublisher);

    await useCase.execute('SomethingElse', 'event-1', {});

    const page = await deliveries.list({ page: 1, pageSize: 10 });
    expect(page.items).toHaveLength(0);
    expect(queuePublisher.enqueued).toHaveLength(0);
  });
});
