import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecordStockMovementUseCase } from '../../application/use-cases/record-stock-movement.usecase';
import { ReverseStockMovementUseCase } from '../../application/use-cases/reverse-stock-movement.usecase';
import { GetProductStockBalanceUseCase } from '../../application/use-cases/get-product-stock-balance.usecase';
import { ListStockMovementsUseCase } from '../../application/use-cases/list-stock-movements.usecase';
import { RecordStockMovementDto } from './requests/record-stock-movement.request.dto';
import { ReverseStockMovementDto } from './requests/reverse-stock-movement.request.dto';
import { IdResponse } from './responses/id.response.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class StockMovementController {
  constructor(
    private readonly recordStockMovementUseCase: RecordStockMovementUseCase,
    private readonly reverseStockMovementUseCase: ReverseStockMovementUseCase,
    private readonly getProductStockBalanceUseCase: GetProductStockBalanceUseCase,
    private readonly listStockMovementsUseCase: ListStockMovementsUseCase,
  ) {}

  @Post('movements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a stock movement' })
  async record(@Body() dto: RecordStockMovementDto): Promise<IdResponse> {
    const id = await this.recordStockMovementUseCase.execute({
      ...dto,
      effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
    });
    return { id };
  }

  @Patch('movements/:id/reverse')
  @ApiOperation({ summary: 'Reverse a stock movement' })
  async reverse(
    @Param('id') id: string,
    @Body() dto: ReverseStockMovementDto,
  ): Promise<IdResponse> {
    await this.reverseStockMovementUseCase.execute({ ...dto, movementId: id });
    return { id };
  }

  @Get('products/:productId/balance')
  @ApiOperation({ summary: 'Get stock balance for a product' })
  async balance(@Param('productId') productId: string): Promise<{
    productId: string;
    quantity: number;
  } | null> {
    return this.getProductStockBalanceUseCase.execute(productId);
  }

  @Get('products/:productId/movements')
  @ApiOperation({ summary: 'List stock movements for a product' })
  async list(@Param('productId') productId: string): Promise<{
    items: Array<{
      id: string;
      grnLineId: string;
      productId: string;
      quantity: number;
      movementType: string;
      sourceDocumentId: string;
      sourceDocumentType: string;
      companyId: string;
      tenantId: string | null;
      actorId: string | null;
      effectiveDate: Date;
      reversalOfId: string | null;
      createdAt: Date;
    }>;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    return this.listStockMovementsUseCase.execute(productId);
  }
}
