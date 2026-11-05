import { Injectable } from '@nestjs/common';
import { KeyedRegistryBase } from '@shared-kernel/utils/keyed-registry.base';
import { ChannelProviderRegistry } from './channel-provider.registry';
import { NotificationHandler } from './ports/notification-handler.port';
import { NotificationHandlerRegistration, NotificationPriority } from './notification.types';
import {
  DuplicateNotificationHandlerRegistrationError,
  NotificationChannelNotRegisteredError,
  UnregisteredNotificationHandlerError,
} from './notification.errors';

interface RegisteredEntry {
  notificationType: string;
  channels: string[];
  priority: NotificationPriority;
  eventName?: string;
  handler: NotificationHandler;
}

/**
 * Map<notificationType, handler>, resolved by string key — the same
 * service-locator pattern as BatchOperationHandlerRegistry /
 * RecurringGeneratorRegistry. Populated by the owning domain module's
 * bootstrap registration; every pipeline component resolves through this and
 * never branches on notificationType itself.
 */
@Injectable()
export class NotificationHandlerRegistry extends KeyedRegistryBase<RegisteredEntry> {
  constructor(private readonly channelProviders: ChannelProviderRegistry) {
    super();
  }

  /**
   * Validates every declared channel has a registered ChannelProvider at
   * registration time — never at the first message. Safe to rely on:
   * NotificationModule registers its built-in providers in its own
   * constructor, which runs during DI graph construction, strictly before
   * any module's onApplicationBootstrap hook (where a domain module calls
   * this method) fires anywhere in the app.
   */
  register(registration: NotificationHandlerRegistration, handler: NotificationHandler): void {
    for (const channel of registration.channels) {
      if (!this.channelProviders.has(channel)) {
        throw new NotificationChannelNotRegisteredError(registration.notificationType, channel);
      }
    }
    this.registerEntry(
      registration.notificationType,
      {
        notificationType: registration.notificationType,
        channels: registration.channels,
        priority: registration.priority,
        eventName: registration.eventName,
        handler,
      },
      () => new DuplicateNotificationHandlerRegistrationError(registration.notificationType),
    );
  }

  resolveHandler(notificationType: string): NotificationHandler {
    return this.requireEntry(
      notificationType,
      () => new UnregisteredNotificationHandlerError(notificationType),
    ).handler;
  }

  declaredChannels(notificationType: string): string[] {
    return this.requireEntry(
      notificationType,
      () => new UnregisteredNotificationHandlerError(notificationType),
    ).channels;
  }

  defaultPriority(notificationType: string): NotificationPriority {
    return this.requireEntry(
      notificationType,
      () => new UnregisteredNotificationHandlerError(notificationType),
    ).priority;
  }

  /** Active (eventName, notificationType) pairs — read by NotificationEventDispatcher. */
  findByEventName(eventName: string): string[] {
    return [...this.entries.values()]
      .filter(entry => entry.eventName === eventName)
      .map(entry => entry.notificationType);
  }

  /** Health indicator — makes "why did no SMS go out for InvoiceOverdue" a five-second diagnosis. */
  health(): Array<{ notificationType: string; channels: string[]; eventName: string | undefined }> {
    return [...this.entries.values()].map(({ notificationType, channels, eventName }) => ({
      notificationType,
      channels: [...channels],
      eventName,
    }));
  }
}
