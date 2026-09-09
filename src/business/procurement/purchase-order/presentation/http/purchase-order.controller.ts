import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PageQuery, normalizePageQuery } from '@shared-kernel/types/pagination';
import { AddPurchaseOrderLineUseCase } from '../../application/usecases/add-purchase-order-line.usecase';
import { CreatePurchaseOrderUseCase } from '../../application/usecases/create-purchase-order.usecase';
import { GetPurchaseOrderUseCase } from '../../application/usecases/get-purchase-order.usecase';
import { ListPurchaseOrdersUseCase } from '../../application/usecases/list-purchase-orders.usecase';
import { PurchaseOrderTransitionUseCase } from '../../application/usecases/purchase-order-transition.usecase';
import { RemovePurchaseOrderLineUseCase } from '../../application/usecases/remove-purchase-order-line.usecase';
import { CreatePurchaseOrderDto } from './requests/create-purchase-order.request.dto';
import { AddLineDto } from './requests/add-purchase-order-line.request.dto';
import { PurchaseOrderQueryDto } from './requests/query-purchase-orders.request.dto';
import { RejectPurchaseOrderDto } from './requests/reject-purchase-order.request.dto';
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
import { ApiResponse } from '@shared-kernel/types/api-response.type';

type PurchaseOrderGetResponse = GetPurchaseOrderMobileResponse | GetPurchaseOrderWebResponse;
type PurchaseOrderListResponse = ListPurchaseOrdersMobileResponse | ListPurchaseOrdersWebResponse;

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(
    private readonly createPurchaseOrderUseCase: CreatePurchaseOrderUseCase,
    private readonly addPurchaseOrderLineUseCase: AddPurchaseOrderLineUseCase,
    private readonly removePurchaseOrderLineUseCase: RemovePurchaseOrderLineUseCase,
    private readonly purchaseOrderTransitionUseCase: PurchaseOrderTransitionUseCase,
    private readonly getPurchaseOrderUseCase: GetPurchaseOrderUseCase,
    private readonly listPurchaseOrdersUseCase: ListPurchaseOrdersUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a purchase order' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePurchaseOrderDto): Promise<ApiResponse<IdResponse>> {
    const id = await this.createPurchaseOrderUseCase.execute({ ...dto });
    return { data: { id: id.toString() }, message: 'Purchase order created' };
  }

  @Get()
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
  @ApiOperation({ summary: 'Get a purchase order by id' })
  @DeviceResponse(GetPurchaseOrderMobileResponseDto, GetPurchaseOrderWebResponseDto)
  async get(@Param('id') id: string): Promise<ApiResponse<PurchaseOrderGetResponse>> {
    const purchaseOrder = await this.getPurchaseOrderUseCase.execute(id);
    if (!purchaseOrder) {
      return { data: null as never, message: 'Purchase order fetched' };
    }
    return {
      data: purchaseOrder,
      message: 'Purchase order fetched',
    };
  }

  @Post(':id/lines')
  @ApiOperation({ summary: 'Add a line to a purchase order' })
  @HttpCode(HttpStatus.CREATED)
  async addLine(
    @Param('id') id: string,
    @Body() dto: AddLineDto,
  ): Promise<ApiResponse<IdResponse>> {
    const poId = await this.addPurchaseOrderLineUseCase.execute({ id, ...dto });
    return { data: { id: poId.toString() }, message: 'Line added' };
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
}
