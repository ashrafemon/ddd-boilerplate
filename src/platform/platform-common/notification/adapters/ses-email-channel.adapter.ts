import { randomUUID } from 'crypto';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { LoggerPort } from '@platform/observability/ports/logger.port';
import { SesService } from '@infrastructure/notification/ses/ses.service';
import { ChannelProvider } from '../ports/channel-provider.port';
import { InvalidWebhookSignatureError } from '../notification.errors';
import {
  ChannelCapabilities,
  DeliveryEvent,
  RenderedMessage,
  SendReceipt,
} from '../notification.types';
import { verifyWebhookSignature } from './webhook-signature.util';

/**
 * ChannelProviderPort for EMAIL, over the existing SesService client. Pure
 * transport — never renders, never decides a recipient, never knows a
 * notificationType. Self-disables (logs and returns a synthetic receipt)
 * when SES is not configured, so local development runs without AWS.
 */
@Injectable()
export class SesEmailChannelAdapter implements ChannelProvider {
  private readonly logger = new Logger(SesEmailChannelAdapter.name);

  constructor(
    private readonly sesService: SesService,
    private readonly configService: ConfigService,
    private readonly observabilityLogger: LoggerPort,
  ) {}

  async send(message: RenderedMessage): Promise<SendReceipt> {
    const client = this.sesService.client;
    const fromAddress = this.sesService.address;
    if (!client || !fromAddress) {
      this.logger.debug(`ses-channel-send-skipped-disabled to=${message.address}`);
      return { providerMessageId: `disabled-${randomUUID()}`, acceptedAt: new Date() };
    }

    const result = await client.send(
      new SendEmailCommand({
        Source: fromAddress,
        Destination: { ToAddresses: [message.address] },
        Message: {
          Subject: { Data: message.subject ?? '', Charset: 'UTF-8' },
          Body: { Html: { Data: message.body, Charset: 'UTF-8' } },
        },
      }),
    );

    const providerMessageId = result.MessageId ?? randomUUID();
    this.observabilityLogger.info('ses-channel-sent', { to: message.address, providerMessageId });
    return { providerMessageId, acceptedAt: new Date() };
  }

  parseDeliveryReceipt(payload: unknown, signature: string | undefined): Promise<DeliveryEvent[]> {
    const { webhookSecret } = this.configService.getSes();
    if (webhookSecret && !verifyWebhookSignature(webhookSecret, payload, signature)) {
      throw new InvalidWebhookSignatureError('ses');
    }
    return Promise.resolve(parseSesEvent(payload));
  }

  capabilities(): ChannelCapabilities {
    return {
      channel: 'EMAIL',
      providerName: 'ses',
      supportsSubject: true,
      maxBodyBytes: 10 * 1024 * 1024,
      ratePerSecond: 14,
    };
  }
}

function parseSesEvent(payload: unknown): DeliveryEvent[] {
  const event = unwrapSnsEnvelope(payload);
  if (!event || typeof event !== 'object') {
    return [];
  }
  const record = event as Record<string, unknown>;
  const mail = record.mail as Record<string, unknown> | undefined;
  const providerMessageId = typeof mail?.messageId === 'string' ? mail.messageId : undefined;
  if (!providerMessageId) {
    return [];
  }

  const at = new Date();
  switch (record.notificationType) {
    case 'Delivery':
      return [{ providerMessageId, status: 'DELIVERED', at }];
    case 'Bounce': {
      const bounce = record.bounce as Record<string, unknown> | undefined;
      const bounceType = typeof bounce?.bounceType === 'string' ? bounce.bounceType : 'Bounce';
      return [{ providerMessageId, status: 'BOUNCED', reason: bounceType, at }];
    }
    case 'Complaint':
      return [{ providerMessageId, status: 'COMPLAINT', reason: 'Complaint', at }];
    default:
      return [];
  }
}

function unwrapSnsEnvelope(payload: unknown): unknown {
  if (
    payload &&
    typeof payload === 'object' &&
    'Message' in payload &&
    typeof (payload as Record<string, unknown>).Message === 'string'
  ) {
    try {
      return JSON.parse((payload as Record<string, unknown>).Message as string);
    } catch {
      return null;
    }
  }
  return payload;
}
