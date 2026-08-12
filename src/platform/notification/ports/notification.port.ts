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
export interface NotificationDispatchPort {
  send(message: NotificationMessage): Promise<void>;
}

export const NOTIFICATION_DISPATCH = Symbol('NOTIFICATION_DISPATCH');
