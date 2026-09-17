import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { ApiResponse } from '@shared-kernel/types/api-response.type';
import { normalizePageQuery } from '@shared-kernel/types/pagination';
import { PageResult } from '@shared-kernel/types/pagination';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { ChannelProviderRegistry } from '../channel-provider.registry';
import { NotificationHandlerRegistry } from '../notification-handler.registry';
import { ApplyDeliveryEventUseCase } from '../usecases/apply-delivery-event.usecase';
import { GetNotificationStatusUseCase } from '../usecases/get-notification-status.usecase';
import { ListNotificationPreferencesUseCase } from '../usecases/list-notification-preferences.usecase';
import { ListNotificationsUseCase } from '../usecases/list-notifications.usecase';
import { SendNotificationUseCase } from '../usecases/send-notification.usecase';
import { UpsertNotificationPreferenceUseCase } from '../usecases/upsert-notification-preference.usecase';
import {
  NotificationMessageRecord,
  NotificationPreferenceRecord,
  NotificationRequestRecord,
} from '../notification.types';
import { DeliveryWebhookDto } from './requests/delivery-webhook.request.dto';
import { NotificationQueryDto } from './requests/notification-query.request.dto';
import { NotifyDto } from './requests/notify.request.dto';
import { UpsertPreferenceDto } from './requests/upsert-notification-preference.request.dto';

/**
 * Generic entry point for every notification-emitting domain module and
 * every channel. Never interprets what a notificationType means —
 * notificationType/channel are strings passed straight through to the
 * pipeline. The webhook route is intentionally unauthenticated at the
 * transport level: trust comes from the per-provider signature check inside
 * ApplyDeliveryEventUseCase, not from a bearer token a provider cannot hold.
 */
@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly sendNotification: SendNotificationUseCase,
    private readonly getStatus: GetNotificationStatusUseCase,
    private readonly listNotifications: ListNotificationsUseCase,
    private readonly listPreferences: ListNotificationPreferencesUseCase,
    private readonly upsertPreference: UpsertNotificationPreferenceUseCase,
    private readonly applyDeliveryEvent: ApplyDeliveryEventUseCase,
    private readonly handlerRegistry: NotificationHandlerRegistry,
    private readonly channelProviderRegistry: ChannelProviderRegistry,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Get('_registry')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List registered notification types and channel providers' })
  registry() {
    return {
      data: {
        notificationTypes: this.handlerRegistry.health(),
        channels: this.channelProviderRegistry.health(),
      },
      message: 'Notification pipeline registry',
    };
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Trigger a notification (Sync 200 with result, Async 202 with request)',
  })
  async notify(
    @Body() dto: NotifyDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<ApiResponse<NotificationRequestRecord>> {
    const ctx = this.requestContext.get();
    const request = await this.sendNotification.execute({
      notificationType: dto.notificationType,
      dedupKey: dto.dedupKey,
      payload: dto.payload,
      sourceEvent: dto.sourceEvent,
      priority: dto.priority,
      tenantId: ctx?.tenantId,
      requestedBy: ctx?.userId,
      traceId: ctx?.correlationId,
    });
    if (request.mode === 'ASYNC') {
      res.status(202);
    }
    return {
      data: request,
      message: `Notification ${request.mode === 'SYNC' ? 'completed' : 'accepted'}`,
    };
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List notification requests' })
  async list(
    @Query() query: NotificationQueryDto,
  ): Promise<ApiResponse<PageResult<NotificationRequestRecord>>> {
    const ctx = this.requestContext.get();
    const page = normalizePageQuery({ page: query.page, pageSize: query.pageSize });
    const requests = await this.listNotifications.execute({
      tenantId: ctx?.tenantId,
      status: query.status,
      notificationType: query.notificationType,
      page: page.page,
      pageSize: page.pageSize,
    });
    return { data: requests, message: 'Notification requests fetched' };
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a notification request status (header + per-message breakdown)' })
  async get(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<
    ApiResponse<{ request: NotificationRequestRecord; messages: NotificationMessageRecord[] }>
  > {
    const result = await this.getStatus.execute(id);
    return { data: result, message: 'Notification request fetched' };
  }

  @Get('preferences/:recipientRef')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a recipient's notification preferences" })
  async getPreferences(
    @Param('recipientRef') recipientRef: string,
  ): Promise<ApiResponse<NotificationPreferenceRecord[]>> {
    const ctx = this.requestContext.get();
    const preferences = await this.listPreferences.execute(ctx?.tenantId, recipientRef);
    return { data: preferences, message: 'Notification preferences fetched' };
  }

  @Put('preferences')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Upsert a recipient's opt-in/out for one category x channel" })
  async putPreference(
    @Body() dto: UpsertPreferenceDto,
  ): Promise<ApiResponse<NotificationPreferenceRecord>> {
    const ctx = this.requestContext.get();
    const preference = await this.upsertPreference.execute({ ...dto, tenantId: ctx?.tenantId });
    return { data: preference, message: 'Notification preference saved' };
  }

  @Post('webhooks/:channel')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Inbound delivery-receipt webhook, one route per channel (email/sms/push) — ' +
      'signature-verified inside the resolved ChannelProvider, never trusted at the transport level',
  })
  async webhook(
    @Param('channel') channel: string,
    @Body() payload: DeliveryWebhookDto,
    @Headers('x-signature') signature: string | undefined,
  ): Promise<ApiResponse<null>> {
    await this.applyDeliveryEvent.execute(channel.toUpperCase(), payload, signature);
    return { data: null, message: 'Delivery receipt processed' };
  }
}
