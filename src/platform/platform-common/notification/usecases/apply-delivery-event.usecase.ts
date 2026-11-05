import { Injectable, Logger } from '@nestjs/common';
import { ChannelProviderRegistry } from '../channel-provider.registry';
import { NotificationMessageRepositoryPort } from '../ports/notification-message-repository.port';
import { NotificationSuppressionRepositoryPort } from '../ports/notification-suppression-repository.port';
import { DeliveryEvent, DeliveryStatus, NotificationSuppressReason } from '../notification.types';

/**
 * PHASE 6 — inbound, unprompted, on the provider's schedule. Verifies the
 * signature (delegated to the resolved ChannelProvider), matches by
 * provider_message_id, and applies the effect. The repository's
 * applyDeliveryStatus only ever moves a message FORWARD along the monotonic
 * status order — a late or duplicate receipt is a safe no-op.
 */
@Injectable()
export class ApplyDeliveryEventUseCase {
  private readonly logger = new Logger(ApplyDeliveryEventUseCase.name);

  constructor(
    private readonly messages: NotificationMessageRepositoryPort,
    private readonly suppressions: NotificationSuppressionRepositoryPort,
    private readonly channelProviders: ChannelProviderRegistry,
  ) {}

  async execute(channel: string, payload: unknown, signature: string | undefined): Promise<void> {
    const provider = this.channelProviders.resolve(channel);
    const events = await provider.parseDeliveryReceipt(payload, signature);

    for (const event of events) {
      await this.applyOne(event);
    }
  }

  private async applyOne(event: DeliveryEvent): Promise<void> {
    const message = await this.messages.findByProviderMessageId(event.providerMessageId);
    if (!message) {
      this.logger.warn(
        `Delivery receipt for unknown provider_message_id ${event.providerMessageId} — dropped`,
      );
      return;
    }

    const { messageStatus, suppressReason } = mapDeliveryEvent(event.status, message.channel);
    const updated = await this.messages.applyDeliveryStatus(
      event.providerMessageId,
      messageStatus,
      event.reason,
      event.at,
    );

    if (updated && suppressReason && message.address) {
      await this.suppressions.suppress(
        message.tenantId ?? undefined,
        message.address,
        message.channel,
        suppressReason,
        message.provider ?? undefined,
      );
    }
  }
}

function mapDeliveryEvent(
  status: DeliveryStatus,
  channel: string,
): {
  messageStatus: 'DELIVERED' | 'BOUNCED' | 'FAILED';
  suppressReason: NotificationSuppressReason | null;
} {
  switch (status) {
    case 'DELIVERED':
      return { messageStatus: 'DELIVERED', suppressReason: null };
    case 'BOUNCED':
      return { messageStatus: 'BOUNCED', suppressReason: 'HARD_BOUNCE' };
    case 'COMPLAINT':
      return { messageStatus: 'BOUNCED', suppressReason: 'COMPLAINT' };
    case 'UNSUBSCRIBED':
      return {
        messageStatus: 'BOUNCED',
        suppressReason: channel === 'SMS' ? 'SMS_STOP' : 'UNSUBSCRIBE',
      };
    case 'FAILED':
    default:
      return { messageStatus: 'FAILED', suppressReason: null };
  }
}
