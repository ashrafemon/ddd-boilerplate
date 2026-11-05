import {
  ChannelCapabilities,
  DeliveryEvent,
  RenderedMessage,
  SendReceipt,
} from '../notification.types';

/**
 * The ONLY outward transport surface. Implemented once per channel
 * (SesEmailChannelAdapter / SnsSmsChannelAdapter / SnsPushChannelAdapter),
 * registered on ChannelProviderRegistry, and resolved by it keyed on channel.
 *
 * Pure transport: never renders, never decides a recipient, never knows a
 * notificationType or aggregate name. Everything it needs arrives as a
 * RenderedMessage; everything it learns returns as a SendReceipt or
 * DeliveryEvent[] for the pipeline to persist.
 */
export interface ChannelProvider {
  /** The physical hand-off to the provider. Returns the provider's own message id. */
  send(message: RenderedMessage): Promise<SendReceipt>;

  /**
   * Verifies the provider's signature and translates its idiosyncratic
   * webhook shape into the pipeline's DeliveryEvent vocabulary. Never applies
   * the effect itself — the controller/use case does that, including writing
   * a suppression on a hard bounce.
   */
  parseDeliveryReceipt(payload: unknown, signature: string | undefined): Promise<DeliveryEvent[]>;

  /** Static description of the channel's limits, so fan-out can be bounded without probing live. */
  capabilities(): ChannelCapabilities;
}
