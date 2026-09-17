import { ChannelProviderRegistry } from './channel-provider.registry';
import { NotificationHandlerRegistry } from './notification-handler.registry';
import { ChannelProvider } from './ports/channel-provider.port';
import { NotificationHandler } from './ports/notification-handler.port';
import {
  DuplicateNotificationHandlerRegistrationError,
  NotificationChannelNotRegisteredError,
  UnregisteredNotificationHandlerError,
} from './notification.errors';

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

function fakeHandler(): NotificationHandler {
  return {
    resolveRecipients: () => Promise.resolve([]),
    resolveModel: () => Promise.resolve({}),
  };
}

function makeSut() {
  const channelProviders = new ChannelProviderRegistry();
  channelProviders.register('EMAIL', fakeChannelProvider('EMAIL'));
  return { channelProviders, registry: new NotificationHandlerRegistry(channelProviders) };
}

describe('NotificationHandlerRegistry', () => {
  it('registers and resolves a handler by notificationType', () => {
    const { registry } = makeSut();
    const handler = fakeHandler();
    registry.register(
      { notificationType: 'InvoiceOverdue', channels: ['EMAIL'], priority: 'NORMAL' },
      handler,
    );

    expect(registry.resolveHandler('InvoiceOverdue')).toBe(handler);
    expect(registry.declaredChannels('InvoiceOverdue')).toEqual(['EMAIL']);
  });

  it('throws at registration when a declared channel has no registered provider', () => {
    const { registry } = makeSut();

    expect(() =>
      registry.register(
        { notificationType: 'InvoiceOverdue', channels: ['SMS'], priority: 'NORMAL' },
        fakeHandler(),
      ),
    ).toThrow(NotificationChannelNotRegisteredError);
  });

  it('throws on a duplicate notificationType registration', () => {
    const { registry } = makeSut();
    registry.register(
      { notificationType: 'InvoiceOverdue', channels: ['EMAIL'], priority: 'NORMAL' },
      fakeHandler(),
    );

    expect(() =>
      registry.register(
        { notificationType: 'InvoiceOverdue', channels: ['EMAIL'], priority: 'NORMAL' },
        fakeHandler(),
      ),
    ).toThrow(DuplicateNotificationHandlerRegistrationError);
  });

  it('throws UnregisteredNotificationHandlerError for an unknown notificationType', () => {
    const { registry } = makeSut();

    expect(() => registry.resolveHandler('Ghost')).toThrow(UnregisteredNotificationHandlerError);
  });

  it('finds notificationTypes registered against an eventName', () => {
    const { registry } = makeSut();
    registry.register(
      {
        notificationType: 'InvoiceOverdue',
        channels: ['EMAIL'],
        priority: 'NORMAL',
        eventName: 'InvoiceOverdueEvent',
      },
      fakeHandler(),
    );

    expect(registry.findByEventName('InvoiceOverdueEvent')).toEqual(['InvoiceOverdue']);
    expect(registry.findByEventName('Other')).toEqual([]);
  });
});
