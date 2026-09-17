import { DomainException } from '@shared-kernel/exceptions/domain.exception';

/** Thrown when a domain module registers a notificationType a second time. */
export class DuplicateNotificationHandlerRegistrationError extends DomainException {
  constructor(notificationType: string) {
    super(
      `NotificationHandler for notificationType '${notificationType}' already registered`,
      'DUPLICATE_NOTIFICATION_HANDLER_REGISTRATION',
      { notificationType },
    );
    this.name = 'DuplicateNotificationHandlerRegistrationError';
  }
}

/** Thrown when a request names a notificationType with no registered handler. */
export class UnregisteredNotificationHandlerError extends DomainException {
  constructor(notificationType: string) {
    super(
      `No NotificationHandler registered for notificationType '${notificationType}'`,
      'UNREGISTERED_NOTIFICATION_HANDLER',
      { notificationType },
    );
    this.name = 'UnregisteredNotificationHandlerError';
  }
}

/** Thrown at boot when a notificationType declares a channel with no registered provider. */
export class NotificationChannelNotRegisteredError extends DomainException {
  constructor(notificationType: string, channel: string) {
    super(
      `notificationType '${notificationType}' declares channel '${channel}' but no ChannelProvider is registered for it`,
      'NOTIFICATION_CHANNEL_NOT_REGISTERED',
      { notificationType, channel },
    );
    this.name = 'NotificationChannelNotRegisteredError';
  }
}

/** Thrown when a channel is registered with a provider a second time. */
export class DuplicateChannelProviderRegistrationError extends DomainException {
  constructor(channel: string) {
    super(
      `ChannelProvider for channel '${channel}' already registered`,
      'DUPLICATE_CHANNEL_PROVIDER_REGISTRATION',
      { channel },
    );
    this.name = 'DuplicateChannelProviderRegistrationError';
  }
}

/** Thrown when a message needs a provider for a channel that has none registered. */
export class UnregisteredChannelProviderError extends DomainException {
  constructor(channel: string) {
    super(
      `No ChannelProvider registered for channel '${channel}'`,
      'UNREGISTERED_CHANNEL_PROVIDER',
      { channel },
    );
    this.name = 'UnregisteredChannelProviderError';
  }
}

/** Thrown when a message needs a template version that does not exist or is inactive. */
export class NotificationTemplateNotFoundError extends DomainException {
  constructor(notificationType: string, channel: string, locale: string) {
    super(
      `No active NotificationTemplate for (${notificationType}, ${channel}, ${locale})`,
      'NOTIFICATION_TEMPLATE_NOT_FOUND',
      { notificationType, channel, locale },
    );
    this.name = 'NotificationTemplateNotFoundError';
  }
}

/** Thrown when an inbound provider webhook fails signature verification. */
export class InvalidWebhookSignatureError extends DomainException {
  constructor(provider: string) {
    super(
      `Webhook signature verification failed for provider '${provider}'`,
      'INVALID_WEBHOOK_SIGNATURE',
      {
        provider,
      },
    );
    this.name = 'InvalidWebhookSignatureError';
  }
}

/** Thrown when a request id does not resolve. */
export class NotificationRequestNotFoundError extends DomainException {
  constructor(requestId: string) {
    super(`NotificationRequest '${requestId}' not found`, 'NOTIFICATION_REQUEST_NOT_FOUND', {
      requestId,
    });
    this.name = 'NotificationRequestNotFoundError';
  }
}

/** Thrown when a request's recipient x channel count exceeds the configured per-request limit. */
export class NotificationSelectionTooLargeError extends DomainException {
  constructor(size: number, limit: number) {
    super(
      `Fan-out of ${size} messages exceeds the maximum of ${limit} per notification request`,
      'NOTIFICATION_SELECTION_TOO_LARGE',
      { size, limit },
    );
    this.name = 'NotificationSelectionTooLargeError';
  }
}
