import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '@shared-kernel/types/api-response.type';
import { normalizePageQuery, PageResult } from '@shared-kernel/types/pagination';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { WebhookEventTypeRegistry } from '../webhook-event-type.registry';
import { WebhookInboundSourceRegistry } from '../webhook-inbound-source.registry';
import { CreateWebhookSubscriptionUseCase } from '../usecases/create-webhook-subscription.usecase';
import { DeleteWebhookSubscriptionUseCase } from '../usecases/delete-webhook-subscription.usecase';
import { GetWebhookSubscriptionUseCase } from '../usecases/get-webhook-subscription.usecase';
import { ListWebhookDeliveriesUseCase } from '../usecases/list-webhook-deliveries.usecase';
import { ListWebhookSubscriptionsUseCase } from '../usecases/list-webhook-subscriptions.usecase';
import { ReceiveInboundWebhookUseCase } from '../usecases/receive-inbound-webhook.usecase';
import { RedeliverWebhookUseCase } from '../usecases/redeliver-webhook.usecase';
import { UpdateWebhookSubscriptionUseCase } from '../usecases/update-webhook-subscription.usecase';
import { WebhookDeliveryRecord, WebhookSubscriptionRecord } from '../webhook.types';
import { CreateWebhookSubscriptionDto } from './requests/create-webhook-subscription.request.dto';
import { InboundWebhookDto } from './requests/inbound-webhook.request.dto';
import { UpdateWebhookSubscriptionDto } from './requests/update-webhook-subscription.request.dto';
import { WebhookDeliveryQueryDto } from './requests/webhook-delivery-query.request.dto';
import { WebhookSubscriptionQueryDto } from './requests/webhook-subscription-query.request.dto';

/**
 * Subscription management is admin/ops-only for v1 — `@ApiBearerAuth()`
 * only, no tenant self-service surface yet (see Plan.md). The inbound route
 * is intentionally unauthenticated at the transport level, same rationale
 * as notification's own webhook route: trust comes from the per-source
 * signature check inside ReceiveInboundWebhookUseCase, not a bearer token an
 * external system cannot hold.
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly createSubscription: CreateWebhookSubscriptionUseCase,
    private readonly updateSubscription: UpdateWebhookSubscriptionUseCase,
    private readonly deleteSubscription: DeleteWebhookSubscriptionUseCase,
    private readonly getSubscription: GetWebhookSubscriptionUseCase,
    private readonly listSubscriptions: ListWebhookSubscriptionsUseCase,
    private readonly listDeliveries: ListWebhookDeliveriesUseCase,
    private readonly redeliverWebhook: RedeliverWebhookUseCase,
    private readonly receiveInboundWebhook: ReceiveInboundWebhookUseCase,
    private readonly eventTypeRegistry: WebhookEventTypeRegistry,
    private readonly inboundSourceRegistry: WebhookInboundSourceRegistry,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Get('_registry')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List registered webhook eventTypes and inbound sources' })
  registry() {
    return {
      data: {
        eventTypes: this.eventTypeRegistry.health(),
        inboundSources: this.inboundSourceRegistry.health(),
      },
      message: 'Webhook registry',
    };
  }

  @Post('subscriptions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a webhook subscription' })
  async create(
    @Body() dto: CreateWebhookSubscriptionDto,
  ): Promise<ApiResponse<WebhookSubscriptionRecord>> {
    const ctx = this.requestContext.get();
    const subscription = await this.createSubscription.execute({
      ...dto,
      tenantId: ctx?.tenantId,
    });
    return { data: subscription, message: 'Webhook subscription created' };
  }

  @Get('subscriptions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List webhook subscriptions' })
  async list(
    @Query() query: WebhookSubscriptionQueryDto,
  ): Promise<ApiResponse<PageResult<WebhookSubscriptionRecord>>> {
    const ctx = this.requestContext.get();
    const page = normalizePageQuery({ page: query.page, pageSize: query.pageSize });
    const subscriptions = await this.listSubscriptions.execute({
      tenantId: ctx?.tenantId,
      status: query.status,
      page: page.page,
      pageSize: page.pageSize,
    });
    return { data: subscriptions, message: 'Webhook subscriptions fetched' };
  }

  @Get('subscriptions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a webhook subscription' })
  async get(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<WebhookSubscriptionRecord>> {
    const ctx = this.requestContext.get();
    const subscription = await this.getSubscription.execute(id, ctx?.tenantId);
    return { data: subscription, message: 'Webhook subscription fetched' };
  }

  @Patch('subscriptions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a webhook subscription (also covers pause/resume/disable)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWebhookSubscriptionDto,
  ): Promise<ApiResponse<WebhookSubscriptionRecord>> {
    const ctx = this.requestContext.get();
    const subscription = await this.updateSubscription.execute(id, dto, ctx?.tenantId);
    return { data: subscription, message: 'Webhook subscription updated' };
  }

  @Delete('subscriptions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a webhook subscription' })
  async delete(@Param('id', new ParseUUIDPipe()) id: string): Promise<ApiResponse<null>> {
    const ctx = this.requestContext.get();
    await this.deleteSubscription.execute(id, ctx?.tenantId);
    return { data: null, message: 'Webhook subscription deleted' };
  }

  @Get('subscriptions/:id/deliveries')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List deliveries for a subscription' })
  async deliveries(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: WebhookDeliveryQueryDto,
  ): Promise<ApiResponse<PageResult<WebhookDeliveryRecord>>> {
    const page = normalizePageQuery({ page: query.page, pageSize: query.pageSize });
    const deliveries = await this.listDeliveries.execute({
      subscriptionId: id,
      status: query.status,
      page: page.page,
      pageSize: page.pageSize,
    });
    return { data: deliveries, message: 'Webhook deliveries fetched' };
  }

  @Post('deliveries/:id/redeliver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually retry a DEAD_LETTER delivery' })
  async redeliver(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<WebhookDeliveryRecord>> {
    const delivery = await this.redeliverWebhook.execute(id);
    return { data: delivery, message: 'Webhook delivery re-queued' };
  }

  @Post('inbound/:source')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Inbound webhook receipt, one route per source — signature-verified inside the ' +
      'resolved source handler, never trusted at the transport level',
  })
  async inbound(
    @Param('source') source: string,
    @Body() payload: InboundWebhookDto,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<ApiResponse<null>> {
    await this.receiveInboundWebhook.execute(source, payload, signature, idempotencyKey);
    return { data: null, message: 'Webhook received' };
  }
}
