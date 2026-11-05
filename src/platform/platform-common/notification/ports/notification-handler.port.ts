import { NotificationContext, Recipient, TemplateModel } from '../notification.types';

/**
 * The ONLY inward surface between the notification pipeline and a
 * notification-emitting domain module. Implemented once per notificationType
 * (e.g. InvoiceNotificationProvider), registered on
 * NotificationHandlerRegistry inside the domain module that owns the event,
 * and resolved by NotificationHandlerRegistry keyed on notificationType.
 *
 * Two methods, one context object. resolveRecipients answers WHO, resolveModel
 * answers WITH WHAT DATA — never WHETHER (that is the gate's job) and never
 * how the message renders or sends (that is the renderer's / provider's job).
 */
export interface NotificationHandler {
  /**
   * The business answer to WHO cares about this event. May return an address
   * it already holds, or just a reference the pipeline resolves later.
   */
  resolveRecipients(
    payload: Record<string, unknown> | undefined,
    context: NotificationContext,
  ): Promise<Recipient[]>;

  /**
   * The business answer to WITH WHAT DATA — a flat, channel-independent model
   * every declared channel's template binds to.
   */
  resolveModel(
    payload: Record<string, unknown> | undefined,
    context: NotificationContext,
  ): Promise<TemplateModel>;
}
