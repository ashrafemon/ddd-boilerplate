import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PURCHASE_ORDER_COMMAND_PORT,
  PurchaseOrderCommandPort,
} from '../ports/inbound/purchase-order.command.port';
import {
  PURCHASE_ORDER_QUERY_PORT,
  PurchaseOrderQueryPort,
} from '../ports/inbound/purchase-order.query.port';
import { PurchaseOrderId } from '../domain/value-objects/purchase-order-id.vo';
import {
  AddLineDto,
  CreatePurchaseOrderDto,
  PurchaseOrderQueryDto,
  RejectPurchaseOrderDto,
} from '../dto/purchase-order.dto';
import { PageQuery, normalizePageQuery } from '@shared-kernal/types/pagination';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(
    @Inject(PURCHASE_ORDER_COMMAND_PORT)
    private readonly commands: PurchaseOrderCommandPort,
    @Inject(PURCHASE_ORDER_QUERY_PORT)
    private readonly queries: PurchaseOrderQueryPort,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a purchase order' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePurchaseOrderDto) {
    const id = await this.commands.createPurchaseOrder({ ...dto });
    return { data: { id: id.toString() }, message: 'Purchase order created' };
  }

  @Get()
  @ApiOperation({ summary: 'List purchase orders' })
  async list(@Query() query: PurchaseOrderQueryDto) {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.queries.listPurchaseOrders(pageQuery);
    return { data: result, message: 'Purchase orders fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a purchase order by id' })
  async get(@Param('id') id: string) {
    const purchaseOrder = await this.queries.getPurchaseOrder(PurchaseOrderId.fromString(id));
    return { data: purchaseOrder, message: 'Purchase order fetched' };
  }

  @Post(':id/lines')
  @ApiOperation({ summary: 'Add a line to a purchase order' })
  @HttpCode(HttpStatus.CREATED)
  async addLine(@Param('id') id: string, @Body() dto: AddLineDto) {
    const poId = await this.commands.addLine({ id, ...dto });
    return { data: { id: poId.toString() }, message: 'Line added' };
  }

  @Delete(':id/lines/:productId')
  @ApiOperation({ summary: 'Remove a line from a purchase order' })
  @HttpCode(HttpStatus.OK)
  async removeLine(@Param('id') id: string, @Param('productId') productId: string) {
    const poId = await this.commands.removeLine({ id, productId });
    return { data: { id: poId.toString() }, message: 'Line removed' };
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit a purchase order' })
  @HttpCode(HttpStatus.OK)
  async submit(@Param('id') id: string) {
    const poId = await this.commands.submit({ id });
    return { data: { id: poId.toString() }, message: 'Purchase order submitted' };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a purchase order' })
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string) {
    const poId = await this.commands.approve({ id });
    return { data: { id: poId.toString() }, message: 'Purchase order approved' };
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a purchase order' })
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id') id: string, @Body() dto: RejectPurchaseOrderDto) {
    const poId = await this.commands.reject({ id, reason: dto.reason });
    return { data: { id: poId.toString() }, message: 'Purchase order rejected' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a purchase order' })
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string) {
    const poId = await this.commands.cancel({ id });
    return { data: { id: poId.toString() }, message: 'Purchase order cancelled' };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a purchase order' })
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id') id: string) {
    const poId = await this.commands.complete({ id });
    return { data: { id: poId.toString() }, message: 'Purchase order completed' };
  }
}
