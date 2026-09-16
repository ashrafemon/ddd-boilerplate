import { INestApplicationContext } from '@nestjs/common';
import { ChannelProviderRegistry } from '@platform/notification/channel-provider.registry';
import { NotificationHandlerRegistry } from '@platform/notification/notification-handler.registry';
import { ChannelProvider } from '@platform/notification/ports/channel-provider.port';
import { NotificationHandler } from '@platform/notification/ports/notification-handler.port';

// Same stubbing rationale as configure-batch-operations.spec.ts / configure-imports.spec.ts:
// keep this a unit test by not loading the real purchase-order module's HTTP/DI graph.
jest.mock('@business/procurement/purchase-order/purchase-order.module', () => ({
  PurchaseOrderModule: class PurchaseOrderModule {},
}));
jest.mock(
  '@business/procurement/purchase-order/infrastructure/adapters/platform/purchase-order-notification.adapter',
  () => ({
    PurchaseOrderNotificationAdapter: class PurchaseOrderNotificationAdapter {},
  }),
);

import { NOTIFICATION_HANDLERS, configureNotifications } from './configure-notifications';

class FakeOwnerModule {}

class FakeNotificationHandler implements NotificationHandler {
  resolveRecipients() {
    return Promise.resolve([]);
  }
  resolveModel() {
    return Promise.resolve({});
  }
}

function fakeChannelProvider(channel: string): ChannelProvider {
  return {
    send: () => Promise.resolve({ providerMessageId: 'x', acceptedAt: new Date() }),
    parseDeliveryReceipt: () => Promise.resolve([]),
    capabilities: () => ({
      channel,
      providerName: 'fake',
      supportsSubject: true,
      maxBodyBytes: 1_000,
      ratePerSecond: 10,
    }),
  };
}

function fakeApp(registry: NotificationHandlerRegistry, handler: NotificationHandler) {
  return {
    get: (token: unknown) => (token === NotificationHandlerRegistry ? registry : undefined),
    select: () => ({ get: () => handler }),
  } as unknown as INestApplicationContext;
}

function makeRegistry() {
  const channelProviders = new ChannelProviderRegistry();
  channelProviders.register('EMAIL', fakeChannelProvider('EMAIL'));
  return new NotificationHandlerRegistry(channelProviders);
}

describe('configureNotifications (composition-root bridge)', () => {
  it('plugs a pure business NotificationHandler into the platform registry', () => {
    const registry = makeRegistry();
    const handler = new FakeNotificationHandler();

    configureNotifications(fakeApp(registry, handler), [
      {
        notificationType: 'DocApproved',
        channels: ['EMAIL'],
        priority: 'NORMAL',
        eventName: 'DocApproved',
        ownerModule: FakeOwnerModule,
        notificationHandler: FakeNotificationHandler,
      },
    ]);

    expect(registry.health()).toEqual([
      { notificationType: 'DocApproved', channels: ['EMAIL'], eventName: 'DocApproved' },
    ]);
    expect(registry.resolveHandler('DocApproved')).toBe(handler);
    expect(registry.findByEventName('DocApproved')).toEqual(['DocApproved']);
  });

  it('fails fast when two rows share a notificationType (template slip)', () => {
    const registry = makeRegistry();
    const app = fakeApp(registry, new FakeNotificationHandler());
    const optIn = {
      notificationType: 'DocApproved',
      channels: ['EMAIL'],
      priority: 'NORMAL' as const,
      ownerModule: FakeOwnerModule,
      notificationHandler: FakeNotificationHandler,
    };

    expect(() => configureNotifications(app, [optIn, optIn])).toThrow(/already registered/);
  });

  it('default table covers exactly the wired notification handlers', () => {
    expect(
      NOTIFICATION_HANDLERS.map(
        ({
          notificationType,
          ownerModule,
          notificationHandler,
        }: {
          notificationType: string;
          ownerModule: { name: string };
          notificationHandler: { name: string };
        }) => [notificationType, ownerModule.name, notificationHandler.name],
      ),
    ).toEqual([
      ['PurchaseOrderApproved', 'PurchaseOrderModule', 'PurchaseOrderNotificationAdapter'],
    ]);
  });
});
