import { Injectable, Logger } from '@nestjs/common';
import { NotificationHandlerRegistry } from './notification-handler.registry';
import { NotificationRequestRepositoryPort } from './ports/notification-request-repository.port';
import { FinaliseNotificationRequestUseCase } from './usecases/finalise-notification-request.usecase';
import { RenderAndSendMessageUseCase } from './usecases/render-and-send-message.usecase';
import { NotificationContext, NotificationDispatch } from './notification.types';

/**
 * Thin driving adapter: consumes a chunk (Async via BullMQ, or Sync
 * in-process), resolves the template model ONCE for the whole chunk — one
 * model renders every channel — then loops messageIds, delegating each to
 * RenderAndSendMessageUseCase. Never decides who is contacted or whether.
 */
@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(
    private readonly requests: NotificationRequestRepositoryPort,
    private readonly registry: NotificationHandlerRegistry,
    private readonly renderAndSend: RenderAndSendMessageUseCase,
    private readonly finalise: FinaliseNotificationRequestUseCase,
  ) {}

  async processChunk(dispatch: NotificationDispatch): Promise<void> {
    await this.requests.markRunning(dispatch.notificationRequestId);

    const request = await this.requests.findById(dispatch.notificationRequestId);
    if (!request) {
      this.logger.warn(
        `NotificationRequest ${dispatch.notificationRequestId} not found — chunk dropped`,
      );
      return;
    }

    const handler = this.registry.resolveHandler(dispatch.notificationType);
    const context: NotificationContext = {
      tenantId: dispatch.tenantId,
      notificationRequestId: dispatch.notificationRequestId,
      notificationType: dispatch.notificationType,
      traceId: dispatch.traceId,
    };
    const model = await handler.resolveModel(request.payload ?? undefined, context);

    for (const messageId of dispatch.messageIds) {
      await this.renderAndSend.execute(dispatch, messageId, model);
    }

    await this.finalise.execute(dispatch.notificationRequestId);
  }
}
