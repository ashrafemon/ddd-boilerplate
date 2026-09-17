import { ConfigService } from '@config/config.service';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { WebhookTransportPort, WebhookTransportResponse } from '../ports/webhook-transport.port';
import { InMemoryWebhookDeliveryRepository } from '../__testing__/in-memory-webhook-delivery.repository';
import { InMemoryWebhookSubscriptionRepository } from '../__testing__/in-memory-webhook-subscription.repository';
import { DeliverWebhookUseCase } from './deliver-webhook.usecase';

const config = {
  getWebhook: () => ({
    deliveryAttempts: 3,
    deliveryTimeoutMs: 5_000,
    backoffBaseMs: 1_000,
    circuitBreakerThreshold: 2,
    reconciliationWindowMs: 600_000,
    workerConcurrency: 5,
  }),
} as unknown as ConfigService;

const appendMock = jest.fn().mockResolvedValue(undefined);
const outbox: OutboxWriterPort = { append: appendMock };

class StubTransport implements WebhookTransportPort {
  constructor(private readonly response: () => WebhookTransportResponse) {}
  post(): Promise<WebhookTransportResponse> {
    return Promise.resolve(this.response());
  }
}

async function seed(
  subscriptions: InMemoryWebhookSubscriptionRepository,
  deliveries: InMemoryWebhookDeliveryRepository,
) {
  const subscription = await subscriptions.create({
    tenantId: null,
    url: 'https://example.com/hook',
    secret: 'a-very-long-shared-secret',
    eventTypes: ['PurchaseOrderApproved'],
  });
  const [delivery] = await deliveries.createMany([
    {
      tenantId: null,
      subscriptionId: subscription.id,
      eventId: 'event-1',
      eventType: 'PurchaseOrderApproved',
      payload: { orderId: 'po-1' },
    },
  ]);
  return { subscription, delivery };
}

describe('DeliverWebhookUseCase', () => {
  it('marks the delivery DELIVERED and resets consecutiveFailures on a 2xx response', async () => {
    const subscriptions = new InMemoryWebhookSubscriptionRepository();
    const deliveries = new InMemoryWebhookDeliveryRepository();
    const { subscription, delivery } = await seed(subscriptions, deliveries);
    const transport = new StubTransport(() => ({ statusCode: 200 }));
    const useCase = new DeliverWebhookUseCase(deliveries, subscriptions, transport, outbox, config);

    await useCase.execute(delivery.id);

    const stored = await deliveries.findById(delivery.id);
    expect(stored?.status).toBe('DELIVERED');
    const storedSubscription = await subscriptions.findById(subscription.id);
    expect(storedSubscription?.consecutiveFailures).toBe(0);
  });

  it('throws (so BullMQ retries) and leaves the delivery PENDING with attemptCount bumped on failure', async () => {
    const subscriptions = new InMemoryWebhookSubscriptionRepository();
    const deliveries = new InMemoryWebhookDeliveryRepository();
    const { delivery } = await seed(subscriptions, deliveries);
    const transport = new StubTransport(() => ({ statusCode: 500 }));
    const useCase = new DeliverWebhookUseCase(deliveries, subscriptions, transport, outbox, config);

    await expect(useCase.execute(delivery.id)).rejects.toThrow();

    const stored = await deliveries.findById(delivery.id);
    expect(stored?.status).toBe('PENDING');
    expect(stored?.attemptCount).toBe(1);
  });

  it('auto-pauses the subscription once consecutiveFailures reaches the circuit-breaker threshold', async () => {
    const subscriptions = new InMemoryWebhookSubscriptionRepository();
    const deliveries = new InMemoryWebhookDeliveryRepository();
    const { subscription } = await seed(subscriptions, deliveries);
    const transport = new StubTransport(() => ({ statusCode: 500 }));
    const useCase = new DeliverWebhookUseCase(deliveries, subscriptions, transport, outbox, config);

    // circuitBreakerThreshold is 2 in this test's config — two failed
    // deliveries (each its own delivery row, since claim() only accepts PENDING).
    for (const eventId of ['event-a', 'event-b']) {
      const [delivery] = await deliveries.createMany([
        {
          tenantId: null,
          subscriptionId: subscription.id,
          eventId,
          eventType: 'PurchaseOrderApproved',
          payload: {},
        },
      ]);
      await expect(useCase.execute(delivery.id)).rejects.toThrow();
    }

    const stored = await subscriptions.findById(subscription.id);
    expect(stored?.status).toBe('PAUSED');
    expect(appendMock).toHaveBeenCalled();
  });
});
