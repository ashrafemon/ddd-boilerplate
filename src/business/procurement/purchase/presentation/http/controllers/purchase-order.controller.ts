import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PageQuery, normalizePageQuery } from '@shared-kernel/types/pagination';
import { CreatePurchaseOrderUseCase } from '../../../application/usecase/create-purchase-order.usecase';
import { AddPurchaseOrderLineUseCase } from '../../../application/usecase/add-purchase-order-line.usecase';
import { RemovePurchaseOrderLineUseCase } from '../../../application/usecase/remove-purchase-order-line.usecase';
import { PurchaseOrderTransitionUseCase } from '../../../application/usecase/purchase-order-transition.usecase';
import { GetPurchaseOrderUseCase } from '../../../application/usecase/get-purchase-order.usecase';
import { ListPurchaseOrdersUseCase } from '../../../application/usecase/list-purchase-orders.usecase';
import {
  AddLineDto,
  CreatePurchaseOrderDto,
  PurchaseOrderQueryDto,
  RejectPurchaseOrderDto,
} from '../request/purchase-order.request';

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
  async create(@Body() dto: CreatePurchaseOrderDto) {
    const id = await this.createPurchaseOrderUseCase.execute({ ...dto });
    return { data: { id: id.toString() }, message: 'Purchase order created' };
  }

  @Get()
  @ApiOperation({ summary: 'List purchase orders' })
  async list(@Query() query: PurchaseOrderQueryDto) {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.listPurchaseOrdersUseCase.execute(pageQuery);
    return { data: result, message: 'Purchase orders fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a purchase order by id' })
  async get(@Param('id') id: string) {
    const purchaseOrder = await this.getPurchaseOrderUseCase.execute(id);
    return { data: purchaseOrder, message: 'Purchase order fetched' };
  }

  @Post(':id/lines')
  @ApiOperation({ summary: 'Add a line to a purchase order' })
  @HttpCode(HttpStatus.CREATED)
  async addLine(@Param('id') id: string, @Body() dto: AddLineDto) {
    const poId = await this.addPurchaseOrderLineUseCase.execute({ id, ...dto });
    return { data: { id: poId.toString() }, message: 'Line added' };
  }

  @Delete(':id/lines/:productId')
  @ApiOperation({ summary: 'Remove a line from a purchase order' })
  @HttpCode(HttpStatus.OK)
  async removeLine(@Param('id') id: string, @Param('productId') productId: string) {
    const poId = await this.removePurchaseOrderLineUseCase.execute({ id, productId });
    return { data: { id: poId.toString() }, message: 'Line removed' };
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit a purchase order' })
  @HttpCode(HttpStatus.OK)
  async submit(@Param('id') id: string) {
    const poId = await this.purchaseOrderTransitionUseCase.execute({ id, transition: 'submit' });
    return { data: { id: poId.toString() }, message: 'Purchase order submitted' };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a purchase order' })
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string) {
    const poId = await this.purchaseOrderTransitionUseCase.execute({ id, transition: 'approve' });
    return { data: { id: poId.toString() }, message: 'Purchase order approved' };
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a purchase order' })
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id') id: string, @Body() dto: RejectPurchaseOrderDto) {
    const poId = await this.purchaseOrderTransitionUseCase.execute({
      id,
      transition: 'reject',
      reason: dto.reason,
    });
    return { data: { id: poId.toString() }, message: 'Purchase order rejected' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a purchase order' })
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string) {
    const poId = await this.purchaseOrderTransitionUseCase.execute({ id, transition: 'cancel' });
    return { data: { id: poId.toString() }, message: 'Purchase order cancelled' };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a purchase order' })
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id') id: string) {
    const poId = await this.purchaseOrderTransitionUseCase.execute({ id, transition: 'complete' });
    return { data: { id: poId.toString() }, message: 'Purchase order completed' };
  }
}
