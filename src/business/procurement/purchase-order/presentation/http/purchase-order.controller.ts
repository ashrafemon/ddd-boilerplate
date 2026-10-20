import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PageQuery, normalizePageQuery } from '@shared-kernel/types/pagination';
import type { RecurringTemplateRecord } from '@platform/recurring/recurring-template.types';
import { AddPurchaseOrderLineUseCase } from '../../application/usecases/add-purchase-order-line.usecase';
import { UpdatePurchaseOrderUseCase } from '../../application/usecases/update-purchase-order.usecase';
import { UpdatePurchaseOrderLineUseCase } from '../../application/usecases/update-purchase-order-line.usecase';
import { GetPurchaseOrderReceiptsUseCase } from '../../application/usecases/get-purchase-order-receipts.usecase';
import { GetPurchaseOrderRemainingQuantitiesUseCase } from '../../application/usecases/get-purchase-order-remaining-quantities.usecase';
import { CreatePurchaseOrderUseCase } from '../../application/usecases/create-purchase-order.usecase';
import { CreateRecurringPurchaseOrderUseCase } from '../../application/usecases/create-recurring-purchase-order.usecase';
import { CreateRecurringFromPurchaseOrderUseCase } from '../../application/usecases/create-recurring-from-purchase-order.usecase';
import { GetPurchaseOrderUseCase } from '../../application/usecases/get-purchase-order.usecase';
import { ListPurchaseOrdersUseCase } from '../../application/usecases/list-purchase-orders.usecase';
import { PurchaseOrderTransitionUseCase } from '../../application/usecases/purchase-order-transition.usecase';
import { AmendPurchaseOrderUseCase } from '../../application/usecases/amend-purchase-order.usecase';
import { IssuePurchaseOrderUseCase } from '../../application/usecases/issue-purchase-order.usecase';
import { ClosePurchaseOrderUseCase } from '../../application/usecases/close-purchase-order.usecase';
import { RemovePurchaseOrderLineUseCase } from '../../application/usecases/remove-purchase-order-line.usecase';
import { CreatePurchaseOrderDto } from './requests/create-purchase-order.request.dto';
import { AddLineDto } from './requests/add-purchase-order-line.request.dto';
import { UpdatePurchaseOrderDto } from './requests/update-purchase-order.request.dto';
import { UpdatePurchaseOrderLineDto } from './requests/update-purchase-order-line.request.dto';
import { PurchaseOrderQueryDto } from './requests/query-purchase-orders.request.dto';
import { RejectPurchaseOrderDto } from './requests/reject-purchase-order.request.dto';
import { AmendPurchaseOrderDto } from './requests/amend-purchase-order.request.dto';
import { CreateRecurringPurchaseOrderDto } from './requests/create-recurring-purchase-order.request.dto';
import { CreateRecurringFromPurchaseOrderDto } from './requests/create-recurring-from-purchase-order.request.dto';
import {
  GetPurchaseOrderMobileResponseDto,
  type GetPurchaseOrderMobileResponse,
} from './responses/get-purchase-order.mobile.response.dto';
import {
  GetPurchaseOrderWebResponseDto,
  type GetPurchaseOrderWebResponse,
} from './responses/get-purchase-order.web.response.dto';
import {
  ListPurchaseOrdersMobileResponseDto,
  type ListPurchaseOrdersMobileResponse,
} from './responses/list-purchase-orders.mobile.response.dto';
import {
  ListPurchaseOrdersWebResponseDto,
  type ListPurchaseOrdersWebResponse,
} from './responses/list-purchase-orders.web.response.dto';
import { IdResponse } from './responses/id.response.dto';
import { DeviceResponse } from '@shared-kernel/decorators/device-response.decorator';
import { Idempotent } from '@platform/idempotency/http/idempotent.decorator';
import { CacheResponseInterceptor } from '@platform/cache/interceptors/cache-response.interceptor';
import { ApiResponse } from '@shared-kernel/types/api-response.type';

type PurchaseOrderGetResponse = GetPurchaseOrderMobileResponse | GetPurchaseOrderWebResponse;
type PurchaseOrderListResponse = ListPurchaseOrdersMobileResponse | ListPurchaseOrdersWebResponse;
type PurchaseOrderReceiptsResponse = Awaited<
  ReturnType<GetPurchaseOrderReceiptsUseCase['execute']>
>;
type PurchaseOrderRemainingQuantitiesResponse = Awaited<
  ReturnType<GetPurchaseOrderRemainingQuantitiesUseCase['execute']>
>;

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(
    private readonly createPurchaseOrderUseCase: CreatePurchaseOrderUseCase,
    private readonly addPurchaseOrderLineUseCase: AddPurchaseOrderLineUseCase,
    private readonly updatePurchaseOrderUseCase: UpdatePurchaseOrderUseCase,
    private readonly updatePurchaseOrderLineUseCase: UpdatePurchaseOrderLineUseCase,
    private readonly removePurchaseOrderLineUseCase: RemovePurchaseOrderLineUseCase,
    private readonly getPurchaseOrderReceiptsUseCase: GetPurchaseOrderReceiptsUseCase,
    private readonly getPurchaseOrderRemainingQuantitiesUseCase: GetPurchaseOrderRemainingQuantitiesUseCase,
    private readonly purchaseOrderTransitionUseCase: PurchaseOrderTransitionUseCase,
    private readonly amendPurchaseOrderUseCase: AmendPurchaseOrderUseCase,
    private readonly issuePurchaseOrderUseCase: IssuePurchaseOrderUseCase,
    private readonly closePurchaseOrderUseCase: ClosePurchaseOrderUseCase,
    private readonly getPurchaseOrderUseCase: GetPurchaseOrderUseCase,
    private readonly listPurchaseOrdersUseCase: ListPurchaseOrdersUseCase,
    private readonly createRecurringPurchaseOrderUseCase: CreateRecurringPurchaseOrderUseCase,
    private readonly createRecurringFromPurchaseOrderUseCase: CreateRecurringFromPurchaseOrderUseCase,
  ) {}

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Create a purchase order' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePurchaseOrderDto): Promise<ApiResponse<IdResponse>> {
    const id = await this.createPurchaseOrderUseCase.execute({ ...dto });
    return { data: { id: id.toString() }, message: 'Purchase order created' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a draft purchase order header' })
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ): Promise<ApiResponse<IdResponse>> {
    const poId = await this.updatePurchaseOrderUseCase.execute({ id, ...dto });
    return { data: { id: poId.toString() }, message: 'Purchase order updated' };
  }

  @Get(':id/receipts')
  @UseInterceptors(CacheResponseInterceptor)
  @ApiOperation({ summary: 'Get receipt status and per-line received/remaining for a PO' })
  async receipts(@Param('id') id: string): Promise<ApiResponse<PurchaseOrderReceiptsResponse>> {
    const receipts = await this.getPurchaseOrderReceiptsUseCase.execute(id);
    return { data: receipts, message: 'Purchase order receipts fetched' };
  }

  @Get(':id/remaining-quantities')
  @UseInterceptors(CacheResponseInterceptor)
  @ApiOperation({ summary: 'Get remaining receivable quantities per PO line' })
  async remainingQuantities(
    @Param('id') id: string,
  ): Promise<ApiResponse<PurchaseOrderRemainingQuantitiesResponse>> {
    const remaining = await this.getPurchaseOrderRemainingQuantitiesUseCase.execute(id);
    return { data: remaining, message: 'Purchase order remaining quantities fetched' };
  }

  @Post('recurring')
  @ApiOperation({ summary: 'Create a recurring purchase order template from new data' })
  @HttpCode(HttpStatus.CREATED)
  async createRecurring(
    @Body() dto: CreateRecurringPurchaseOrderDto,
  ): Promise<ApiResponse<RecurringTemplateRecord>> {
    const template = await this.createRecurringPurchaseOrderUseCase.execute({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
    return { data: template, message: 'Recurring purchase order template created' };
  }

  @Get()
  @UseInterceptors(CacheResponseInterceptor)
  @ApiOperation({ summary: 'List purchase orders' })
  @DeviceResponse(ListPurchaseOrdersMobileResponseDto, ListPurchaseOrdersWebResponseDto)
  async list(
    @Query() query: PurchaseOrderQueryDto,
  ): Promise<ApiResponse<PurchaseOrderListResponse>> {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.listPurchaseOrdersUseCase.execute(pageQuery);
    return {
      data: result,
      message: 'Purchase orders fetched',
    };
  }

  @Get(':id')
  @UseInterceptors(CacheResponseInterceptor)
  @ApiOperation({ summary: 'Get a purchase order by id' })
  @DeviceResponse(GetPurchaseOrderMobileResponseDto, GetPurchaseOrderWebResponseDto)
  async get(@Param('id') id: string): Promise<ApiResponse<PurchaseOrderGetResponse>> {
    const purchaseOrder = await this.getPurchaseOrderUseCase.execute(id);
    if (!purchaseOrder) {
      // Missing or owned by another tenant — NOT FOUND either way, so a
      // foreign row leaks no existence (plan §C: missing/foreign rows 404).
      throw new NotFoundException('Purchase order not found');
    }
    return {
      data: purchaseOrder,
      message: 'Purchase order fetched',
    };
  }

  @Post(':id/recurring')
  @ApiOperation({ summary: 'Create a recurring template from an existing purchase order' })
  @HttpCode(HttpStatus.CREATED)
  async createRecurringFromExisting(
    @Param('id') id: string,
    @Body() dto: CreateRecurringFromPurchaseOrderDto,
  ): Promise<ApiResponse<RecurringTemplateRecord>> {
    const template = await this.createRecurringFromPurchaseOrderUseCase.execute({
      ...dto,
      purchaseOrderId: id,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
    return { data: template, message: 'Recurring purchase order template created' };
  }

  @Patch(':id/lines')
  @ApiOperation({ summary: 'Add a line to a purchase order' })
  @HttpCode(HttpStatus.CREATED)
  async addLine(
    @Param('id') id: string,
    @Body() dto: AddLineDto,
  ): Promise<ApiResponse<IdResponse>> {
    const poId = await this.addPurchaseOrderLineUseCase.execute({ id, ...dto });
    return { data: { id: poId.toString() }, message: 'Line added' };
  }

  @Patch(':id/lines/:productId')
  @ApiOperation({ summary: 'Rewrite a draft purchase order line' })
  @HttpCode(HttpStatus.OK)
  async updateLine(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() dto: UpdatePurchaseOrderLineDto,
  ): Promise<ApiResponse<IdResponse>> {
    const poId = await this.updatePurchaseOrderLineUseCase.execute({
      id,
      productId,
      ...dto,
    });
    return { data: { id: poId.toString() }, message: 'Purchase order line updated' };
  }

  @Delete(':id/lines/:productId')
  @ApiOperation({ summary: 'Remove a line from a purchase order' })
  @HttpCode(HttpStatus.OK)
  async removeLine(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ): Promise<ApiResponse<IdResponse>> {
    const poId = await this.removePurchaseOrderLineUseCase.execute({ id, productId });
    return { data: { id: poId.toString() }, message: 'Line removed' };
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Submit a purchase order' })
  @HttpCode(HttpStatus.OK)
  async submit(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const poId = await this.purchaseOrderTransitionUseCase.execute({ id, transition: 'submit' });
    return { data: { id: poId.toString() }, message: 'Purchase order submitted' };
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a purchase order' })
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const poId = await this.purchaseOrderTransitionUseCase.execute({ id, transition: 'approve' });
    return { data: { id: poId.toString() }, message: 'Purchase order approved' };
  }

  @Patch(':id/amend')
  @ApiOperation({ summary: 'Amend an issued purchase order (controlled change)' })
  @HttpCode(HttpStatus.OK)
  async amend(
    @Param('id') id: string,
    @Body() dto: AmendPurchaseOrderDto,
  ): Promise<ApiResponse<IdResponse>> {
    const poId = await this.amendPurchaseOrderUseCase.execute({
      id,
      expectedDeliveryDate: dto.expectedDeliveryDate,
      lineUnitPrices: dto.lineUnitPrices,
      reason: dto.reason,
    });
    return { data: { id: poId.toString() }, message: 'Purchase order amended' };
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a purchase order' })
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectPurchaseOrderDto,
  ): Promise<ApiResponse<IdResponse>> {
    const poId = await this.purchaseOrderTransitionUseCase.execute({
      id,
      transition: 'reject',
      reason: dto.reason,
    });
    return { data: { id: poId.toString() }, message: 'Purchase order rejected' };
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a purchase order' })
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const poId = await this.purchaseOrderTransitionUseCase.execute({ id, transition: 'cancel' });
    return { data: { id: poId.toString() }, message: 'Purchase order cancelled' };
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete a purchase order' })
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const poId = await this.purchaseOrderTransitionUseCase.execute({ id, transition: 'complete' });
    return { data: { id: poId.toString() }, message: 'Purchase order completed' };
  }

  @Patch(':id/issue')
  @ApiOperation({ summary: 'Issue a purchase order' })
  @HttpCode(HttpStatus.OK)
  async issue(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const poId = await this.issuePurchaseOrderUseCase.execute(id);
    return { data: { id: poId.toString() }, message: 'Purchase order issued' };
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Close a purchase order' })
  @HttpCode(HttpStatus.OK)
  async close(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const poId = await this.closePurchaseOrderUseCase.execute(id);
    return { data: { id: poId.toString() }, message: 'Purchase order closed' };
  }
}
