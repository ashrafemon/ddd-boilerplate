export interface NotificationPayload {
  subject: string;
  body: string;
  tenantId?: string;
  organizationId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationChannel {
  channel: 'email' | 'push' | 'sms';
  recipient: string;
}

export interface NotificationMessage extends NotificationPayload {
  channels: NotificationChannel[];
}

/**
 * Notification abstraction (AWS SNS by default).
 */
export abstract class NotificationPort {
  public abstract send(message: NotificationMessage): Promise<void>;
}
