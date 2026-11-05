import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import {
  WebhookDeliveryRecord,
  WebhookDeliveryStatus,
  WebhookSubscriptionRecord,
  WebhookSubscriptionStatus,
} from '../webhook.types';

export interface SubscriptionRow {
  id: string;
  tenantId: string | null;
  url: string;
  secret: string;
  eventTypes: string[];
  status: string;
  description: string | null;
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryRow {
  id: string;
  tenantId: string | null;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  status: string;
  attemptCount: number;
  nextAttemptAt: Date;
  claimedAt: Date | null;
  lastResponseCode: number | null;
  lastError: string | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookMapper {
  static toSubscriptionRecord(row: SubscriptionRow): WebhookSubscriptionRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      url: row.url,
      secret: row.secret,
      eventTypes: row.eventTypes,
      status: row.status as WebhookSubscriptionStatus,
      description: row.description,
      consecutiveFailures: row.consecutiveFailures,
      lastSuccessAt: row.lastSuccessAt,
      lastFailureAt: row.lastFailureAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  static toDeliveryRecord(row: DeliveryRow): WebhookDeliveryRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      subscriptionId: row.subscriptionId,
      eventId: row.eventId,
      eventType: row.eventType,
      payload: PrismaJson.asRecord(row.payload) ?? {},
      status: row.status as WebhookDeliveryStatus,
      attemptCount: row.attemptCount,
      nextAttemptAt: row.nextAttemptAt,
      claimedAt: row.claimedAt,
      lastResponseCode: row.lastResponseCode,
      lastError: row.lastError,
      deliveredAt: row.deliveredAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
