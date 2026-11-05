import { randomUUID } from 'crypto';
import { PublishCommand } from '@aws-sdk/client-sns';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { LoggerPort } from '@platform/observability/ports/logger.port';
import { SnsService } from '@infrastructure/notification/sns/sns.service';
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
 * ChannelProviderPort for SMS and PUSH, over the existing generic SnsService
 * client — this repo talks to neither Twilio nor FCM today. Two thin classes
 * (one per channel, per the port contract) sharing the same publish/parse
 * logic.
 *
 * Real AWS SMS/push delivery status normally arrives via a CloudWatch Logs
 * subscription or an SNS success/failure feedback topic, not a single
 * provider webhook shape the way SES bounce/complaint notifications do — the
 * workbook itself lists "no-webhook providers" as an open item. This adapter
 * accepts an already-normalised `{ providerMessageId, status, reason }`
 * payload rather than fabricating CloudWatch parsing; wiring the real feed is
 * a follow-up, not a gap in the pipeline's own architecture.
 */
abstract class BaseSnsChannelAdapter implements ChannelProvider {
  private readonly logger = new Logger(BaseSnsChannelAdapter.name);

  protected constructor(
    protected readonly channel: 'SMS' | 'PUSH',
    private readonly snsService: SnsService,
    private readonly configService: ConfigService,
    private readonly observabilityLogger: LoggerPort,
  ) {}

  async send(message: RenderedMessage): Promise<SendReceipt> {
    const client = this.snsService.client;
    const topicArn = this.snsService.topic;
    if (!client || !topicArn) {
      this.logger.debug(
        `sns-channel-send-skipped-disabled channel=${this.channel} to=${message.address}`,
      );
      return { providerMessageId: `disabled-${randomUUID()}`, acceptedAt: new Date() };
    }

    const result = await client.send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify({
          channel: this.channel,
          address: message.address,
          body: message.body,
          metadata: message.metadata ?? {},
        }),
        MessageAttributes: {
          channel: { DataType: 'String', StringValue: this.channel },
        },
      }),
    );

    const providerMessageId = result.MessageId ?? randomUUID();
    this.observabilityLogger.info('sns-channel-sent', {
      channel: this.channel,
      to: message.address,
      providerMessageId,
    });
    return { providerMessageId, acceptedAt: new Date() };
  }

  parseDeliveryReceipt(payload: unknown, signature: string | undefined): Promise<DeliveryEvent[]> {
    const { webhookSecret } = this.configService.getSns();
    if (webhookSecret && !verifyWebhookSignature(webhookSecret, payload, signature)) {
      throw new InvalidWebhookSignatureError('sns');
    }
    return Promise.resolve(parseNormalisedDeliveryEvent(payload));
  }

  abstract capabilities(): ChannelCapabilities;
}

@Injectable()
export class SnsSmsChannelAdapter extends BaseSnsChannelAdapter {
  constructor(
    snsService: SnsService,
    configService: ConfigService,
    observabilityLogger: LoggerPort,
  ) {
    super('SMS', snsService, configService, observabilityLogger);
  }

  capabilities(): ChannelCapabilities {
    return {
      channel: 'SMS',
      providerName: 'sns',
      supportsSubject: false,
      maxBodyBytes: 1_600,
      ratePerSecond: 1,
    };
  }
}

@Injectable()
export class SnsPushChannelAdapter extends BaseSnsChannelAdapter {
  constructor(
    snsService: SnsService,
    configService: ConfigService,
    observabilityLogger: LoggerPort,
  ) {
    super('PUSH', snsService, configService, observabilityLogger);
  }

  capabilities(): ChannelCapabilities {
    return {
      channel: 'PUSH',
      providerName: 'sns',
      supportsSubject: false,
      maxBodyBytes: 4_096,
      ratePerSecond: 500,
    };
  }
}

function parseNormalisedDeliveryEvent(payload: unknown): DeliveryEvent[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const record = payload as Record<string, unknown>;
  const providerMessageId = record.providerMessageId;
  const status = record.status;
  if (typeof providerMessageId !== 'string' || typeof status !== 'string') {
    return [];
  }
  if (!['DELIVERED', 'BOUNCED', 'FAILED', 'COMPLAINT', 'UNSUBSCRIBED'].includes(status)) {
    return [];
  }
  return [
    {
      providerMessageId,
      status: status as DeliveryEvent['status'],
      reason: typeof record.reason === 'string' ? record.reason : undefined,
      at: new Date(),
    },
  ];
}
