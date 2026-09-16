import { DomainException } from '@shared-kernel/exceptions/domain.exception';

/** Thrown when a subscription id does not resolve. */
export class WebhookSubscriptionNotFoundError extends DomainException {
  constructor(id: string) {
    super(`WebhookSubscription '${id}' not found`, 'WEBHOOK_SUBSCRIPTION_NOT_FOUND', { id });
    this.name = 'WebhookSubscriptionNotFoundError';
  }
}

/** Thrown when a delivery id does not resolve. */
export class WebhookDeliveryNotFoundError extends DomainException {
  constructor(id: string) {
    super(`WebhookDelivery '${id}' not found`, 'WEBHOOK_DELIVERY_NOT_FOUND', { id });
    this.name = 'WebhookDeliveryNotFoundError';
  }
}

/** Thrown when a subscription requests an eventType not on the boot-time allowlist. */
export class WebhookEventTypeNotAllowedError extends DomainException {
  constructor(eventType: string) {
    super(
      `eventType '${eventType}' is not registered in WEBHOOK_EVENT_TYPES`,
      'WEBHOOK_EVENT_TYPE_NOT_ALLOWED',
      { eventType },
    );
    this.name = 'WebhookEventTypeNotAllowedError';
  }
}

/** Thrown when an inbound webhook fails signature verification. */
export class InvalidWebhookSignatureError extends DomainException {
  constructor(source: string) {
    super(
      `Webhook signature verification failed for source '${source}'`,
      'INVALID_WEBHOOK_SIGNATURE',
      { source },
    );
    this.name = 'InvalidWebhookSignatureError';
  }
}

/** Thrown when WEBHOOK_EVENT_TYPES lists the same eventType twice at boot. */
export class DuplicateWebhookEventTypeRegistrationError extends DomainException {
  constructor(eventType: string) {
    super(
      `eventType '${eventType}' already registered in WebhookEventTypeRegistry`,
      'DUPLICATE_WEBHOOK_EVENT_TYPE_REGISTRATION',
      { eventType },
    );
    this.name = 'DuplicateWebhookEventTypeRegistrationError';
  }
}

/** Thrown when a domain module registers an inbound source a second time. */
export class DuplicateWebhookInboundSourceRegistrationError extends DomainException {
  constructor(source: string) {
    super(
      `WebhookInboundHandler for source '${source}' already registered`,
      'DUPLICATE_WEBHOOK_INBOUND_SOURCE_REGISTRATION',
      { source },
    );
    this.name = 'DuplicateWebhookInboundSourceRegistrationError';
  }
}

/** Thrown when an inbound request names a source with no registered handler. */
export class UnregisteredWebhookInboundSourceError extends DomainException {
  constructor(source: string) {
    super(
      `No WebhookInboundHandler registered for source '${source}'`,
      'UNREGISTERED_WEBHOOK_INBOUND_SOURCE',
      { source },
    );
    this.name = 'UnregisteredWebhookInboundSourceError';
  }
}
