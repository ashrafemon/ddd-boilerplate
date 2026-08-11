import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { ISesConfig } from '@config/notification.config';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailMessage, EmailPort } from '../../../shared-kernel/ports/notification/email.port';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';

/**
 * AWS SES email adapter. Self-disables when SES is not configured.
 */
@Injectable()
export class SesEmailAdapter implements EmailPort {
  private readonly ses?: SESClient;
  private readonly fromAddress?: string;

  constructor(
    config: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    const sesConfig = config.get<ISesConfig>('notification.ses');
    if (!sesConfig?.accessKey || !sesConfig.secretKey || !sesConfig.address) {
      return;
    }

    this.ses = new SESClient({
      region: sesConfig.region,
      credentials: { accessKeyId: sesConfig.accessKey, secretAccessKey: sesConfig.secretKey },
    });
    this.fromAddress = sesConfig.address;
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
