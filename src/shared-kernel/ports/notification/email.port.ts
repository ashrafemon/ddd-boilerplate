export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  correlationId?: string;
  tenantId?: string;
  organizationId?: string;
}

/**
 * Email abstraction (AWS SES by default).
 */
export abstract class EmailPort {
  public abstract send(message: EmailMessage): Promise<void>;
}
