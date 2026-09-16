import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { InMemoryWebhookSubscriptionRepository } from '../__testing__/in-memory-webhook-subscription.repository';
import { WebhookEventTypeRegistry } from '../webhook-event-type.registry';
import { WebhookEventTypeNotAllowedError } from '../webhook.errors';
import { CreateWebhookSubscriptionUseCase } from './create-webhook-subscription.usecase';

const noContext = { getTenantId: () => undefined } as unknown as RequestContextPort;

describe('CreateWebhookSubscriptionUseCase', () => {
  it('rejects an eventType not on the WebhookEventTypeRegistry allowlist', async () => {
    const registry = new WebhookEventTypeRegistry();
    registry.register('PurchaseOrderApproved');
    const useCase = new CreateWebhookSubscriptionUseCase(
      new InMemoryWebhookSubscriptionRepository(),
      registry,
      noContext,
    );

    await expect(
      useCase.execute({
        url: 'https://example.com/hook',
        secret: 'a-very-long-shared-secret',
        eventTypes: ['SomethingNotAllowlisted'],
      }),
    ).rejects.toThrow(WebhookEventTypeNotAllowedError);
  });

  it('creates the subscription when every eventType is allowlisted', async () => {
    const registry = new WebhookEventTypeRegistry();
    registry.register('PurchaseOrderApproved');
    const useCase = new CreateWebhookSubscriptionUseCase(
      new InMemoryWebhookSubscriptionRepository(),
      registry,
      noContext,
    );

    const subscription = await useCase.execute({
      url: 'https://example.com/hook',
      secret: 'a-very-long-shared-secret',
      eventTypes: ['PurchaseOrderApproved'],
    });

    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.eventTypes).toEqual(['PurchaseOrderApproved']);
  });
});
