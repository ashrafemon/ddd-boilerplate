import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { ChannelProviderRegistry } from '../channel-provider.registry';
import { TemplateRenderer } from '../template-renderer';
import { NotificationMessageRepositoryPort } from '../ports/notification-message-repository.port';
import { NotificationRequestRepositoryPort } from '../ports/notification-request-repository.port';
import { NotificationTemplateRepositoryPort } from '../ports/notification-template-repository.port';
import { NotificationTemplateNotFoundError } from '../notification.errors';
import { NotificationDispatch, TemplateModel } from '../notification.types';

/**
 * PHASE 5 — one message. Claim, resolve template, render, resolve the
 * channel provider, send, record the outcome. Never decides WHO or WHETHER —
 * the gate already ran in Phase 2-3.
 */
@Injectable()
export class RenderAndSendMessageUseCase {
  private readonly logger = new Logger(RenderAndSendMessageUseCase.name);

  constructor(
    private readonly messages: NotificationMessageRepositoryPort,
    private readonly requests: NotificationRequestRepositoryPort,
    private readonly templates: NotificationTemplateRepositoryPort,
    private readonly channelProviders: ChannelProviderRegistry,
    private readonly renderer: TemplateRenderer,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    dispatch: NotificationDispatch,
    messageId: string,
    model: TemplateModel,
  ): Promise<'PROCESSED' | 'SKIPPED_CLAIM'> {
    const claimed = await this.messages.claim(messageId);
    if (!claimed) {
      return 'SKIPPED_CLAIM';
    }

    const { renderedSnapshotMaxBytes } = this.configService.getNotificationPipeline();

    try {
      if (!claimed.address) {
        throw new Error(`Message ${messageId} has no resolved address to send to`);
      }

      const locale = claimed.locale ?? dispatch.defaultLocale ?? 'en-US';
      const template = await this.templates.resolveActive(
        claimed.tenantId ?? undefined,
        dispatch.notificationType,
        claimed.channel,
        locale,
      );
      if (!template) {
        throw new NotificationTemplateNotFoundError(
          dispatch.notificationType,
          claimed.channel,
          locale,
        );
      }

      const renderedTemplate = this.renderer.render(template, model);
      const provider = this.channelProviders.resolve(claimed.channel);
      const receipt = await provider.send({
        address: claimed.address,
        subject: renderedTemplate.subject,
        body: renderedTemplate.body,
      });

      await this.messages.markSent(messageId, {
        templateId: template.id,
        provider: provider.capabilities().providerName,
        providerMessageId: receipt.providerMessageId,
        renderedSnapshot: capSnapshot({ ...renderedTemplate }, renderedSnapshotMaxBytes),
      });
      await this.requests.incrementProgress(dispatch.notificationRequestId, 'SENT');
      return 'PROCESSED';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Notification message ${messageId} (${dispatch.notificationType}/${claimed.channel}) failed: ${message}`,
      );
      await this.messages.markFailed(messageId, message);
      await this.requests.incrementProgress(dispatch.notificationRequestId, 'FAILED');
      return 'PROCESSED';
    }
  }
}

function capSnapshot(snapshot: Record<string, unknown>, maxBytes: number): Record<string, unknown> {
  const size = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
  if (size <= maxBytes) {
    return snapshot;
  }
  return { _truncated: true, _originalBytes: size };
}
