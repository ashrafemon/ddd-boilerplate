export type WebhookSubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED';
export type WebhookDeliveryStatus = 'PENDING' | 'DELIVERING' | 'DELIVERED' | 'DEAD_LETTER';

export interface WebhookSubscriptionRecord {
  id: string;
  tenantId: string | null;
  url: string;
  secret: string;
  eventTypes: string[];
  status: WebhookSubscriptionStatus;
  description: string | null;
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewWebhookSubscription {
  tenantId: string | null;
  url: string;
  secret: string;
  eventTypes: string[];
  description?: string | null;
}

export interface UpdateWebhookSubscriptionInput {
  url?: string;
  secret?: string;
  eventTypes?: string[];
  status?: WebhookSubscriptionStatus;
  description?: string | null;
}

export interface WebhookSubscriptionQuery {
  tenantId?: string;
  status?: WebhookSubscriptionStatus;
  page: number;
  pageSize: number;
}

export interface WebhookDeliveryRecord {
  id: string;
  tenantId: string | null;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  nextAttemptAt: Date;
  claimedAt: Date | null;
  lastResponseCode: number | null;
  lastError: string | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewWebhookDelivery {
  tenantId: string | null;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface WebhookDeliveryQuery {
  subscriptionId?: string;
  status?: WebhookDeliveryStatus;
  page: number;
  pageSize: number;
}

/**
 * Verifies an inbound webhook's raw body against its signature header;
 * `true` = trusted. Registered per-source at boot — the secret is baked into
 * the closure (e.g. read from ConfigService), never passed across this
 * boundary.
 */
export type WebhookSignatureVerifier = (rawBody: unknown, signature: string | undefined) => boolean;

export interface InboundWebhookContext {
  source: string;
  receivedAt: Date;
}
