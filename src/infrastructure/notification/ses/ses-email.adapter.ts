import { SendEmailCommand } from '@aws-sdk/client-ses';
import { Injectable } from '@nestjs/common';
import { EmailMessage, EmailPort } from '@shared-kernel/ports/notification/email.port';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';
import { SesService } from './ses.service';

/**
 * AWS SES email adapter. Self-disables when SES is not configured.
 */
@Injectable()
export class SesEmailAdapter implements EmailPort {
  constructor(
    private readonly sesService: SesService,
    private readonly logger: LoggerPort,
  ) {}

  public async send(message: EmailMessage): Promise<void> {
    const client = this.sesService.client;
    const fromAddress = this.sesService.address;
    if (!client || !fromAddress) {
      this.logger.debug('ses-email-skipped-disabled', { to: message.to, subject: message.subject });
      return;
    }

    await client.send(
      new SendEmailCommand({
        Source: message.from ?? fromAddress,
        Destination: { ToAddresses: [message.to] },
        Message: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: message.html
            ? { Html: { Data: message.html, Charset: 'UTF-8' } }
            : { Text: { Data: message.text ?? message.subject, Charset: 'UTF-8' } },
        },
        Tags: [
          { Name: 'correlationId', Value: message.correlationId ?? '' },
          { Name: 'tenantId', Value: message.tenantId ?? '' },
          { Name: 'organizationId', Value: message.organizationId ?? '' },
        ],
      }),
    );

    this.logger.info('ses-email-sent', {
      to: message.to,
      subject: message.subject,
      correlationId: message.correlationId,
    });
  }
}
