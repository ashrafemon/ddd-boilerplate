import { Injectable } from '@nestjs/common';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { ConfigurationService } from '../../../config/configuration.service';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';
import { EmailMessage, EmailPort } from '../../../shared-kernel/ports/notification/email.port';

/**
 * AWS SES email adapter. Self-disables when SES is not configured.
 */
@Injectable()
export class SesEmailAdapter implements EmailPort {
  private readonly ses?: SESClient;
  private readonly fromAddress?: string;

  constructor(
    configuration: ConfigurationService,
    private readonly logger: LoggerPort,
  ) {
    const sesSettings = configuration.getSes();
    if (sesSettings.enabled && sesSettings.fromAddress) {
      const aws = configuration.getAws();
      this.ses = new SESClient({
        region: aws.region,
        credentials: aws.accessKeyId
          ? { accessKeyId: aws.accessKeyId, secretAccessKey: aws.secretAccessKey }
          : undefined,
      });
      this.fromAddress = sesSettings.fromAddress;
    }
  }

  public async send(message: EmailMessage): Promise<void> {
    if (!this.ses || !this.fromAddress) {
      this.logger.debug('ses-email-skipped-disabled', { to: message.to, subject: message.subject });
      return;
    }

    await this.ses.send(
      new SendEmailCommand({
        Source: message.from ?? this.fromAddress,
        Destination: { ToAddresses: [message.to] },
        Message: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: message.html
            ? { Html: { Data: message.html, Charset: 'UTF-8' } }
            : { Text: { Data: message.text ?? message.subject, Charset: 'UTF-8' } },
        },
        ConfigurationSetName: undefined,
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
