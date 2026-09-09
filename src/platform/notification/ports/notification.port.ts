export interface NotificationMessage {
  to: string;
  subject: string;
  body: string;
  channel?: 'email' | 'push' | 'sms';
  tenantId?: string;
  organizationId?: string;
  correlationId?: string;
}

/**
 * Notification port. Business modules request notifications through this port;
 * the platform dispatches them over the configured infrastructure channels
 * (SES email / SNS push). Business never talks to the AWS clients directly.
 */
export abstract class NotificationDispatchPort {
  abstract send(message: NotificationMessage): Promise<void>;
}

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

export interface NotificationMessageInternal extends NotificationPayload {
  channels: NotificationChannel[];
}

/**
 * Notification abstraction (AWS SNS by default).
 */
export abstract class NotificationPort {
  public abstract send(message: NotificationMessageInternal): Promise<void>;
}
