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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePriceListUseCase } from '../../application/use-cases/create-price-list.usecase';
import { UpdatePriceListUseCase } from '../../application/use-cases/update-price-list.usecase';
import { AddPriceListLineUseCase } from '../../application/use-cases/add-price-list-line.usecase';
import { RemovePriceListLineUseCase } from '../../application/use-cases/remove-price-list-line.usecase';
import { ActivatePriceListUseCase } from '../../application/use-cases/activate-price-list.usecase';
import { DeactivatePriceListUseCase } from '../../application/use-cases/deactivate-price-list.usecase';
import { ArchivePriceListUseCase } from '../../application/use-cases/archive-price-list.usecase';
import { GetProductPriceUseCase } from '../../application/use-cases/get-product-price.usecase';
import { CreatePriceListDto } from './requests/create-price-list.request.dto';
import { UpdatePriceListDto } from './requests/update-price-list.request.dto';
import { AddPriceListLineDto } from './requests/add-price-list-line.request.dto';
import { ActivatePriceListDto } from './requests/activate-price-list.request.dto';
import { DeactivatePriceListDto } from './requests/deactivate-price-list.request.dto';
import { ArchivePriceListDto } from './requests/archive-price-list.request.dto';
import { IdResponse } from './responses/id.response.dto';

@ApiTags('price-lists')
@ApiBearerAuth()
@Controller('price-lists')
export class PriceListController {
  constructor(
    private readonly createPriceListUseCase: CreatePriceListUseCase,
    private readonly updatePriceListUseCase: UpdatePriceListUseCase,
    private readonly addPriceListLineUseCase: AddPriceListLineUseCase,
    private readonly removePriceListLineUseCase: RemovePriceListLineUseCase,
    private readonly activatePriceListUseCase: ActivatePriceListUseCase,
    private readonly deactivatePriceListUseCase: DeactivatePriceListUseCase,
    private readonly archivePriceListUseCase: ArchivePriceListUseCase,
    private readonly getProductPriceUseCase: GetProductPriceUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new price list' })
  async create(@Body() dto: CreatePriceListDto): Promise<IdResponse> {
    const id = await this.createPriceListUseCase.execute(dto);
    return { id };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a price list' })
  async update(@Param('id') id: string, @Body() dto: UpdatePriceListDto): Promise<IdResponse> {
    await this.updatePriceListUseCase.execute({ ...dto, id });
    return { id };
  }

  @Post(':priceListId/lines')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a line to a price list' })
  async addLine(
    @Param('priceListId') priceListId: string,
    @Body() dto: AddPriceListLineDto,
  ): Promise<IdResponse> {
    await this.addPriceListLineUseCase.execute({ ...dto, priceListId });
    return { id: priceListId };
  }

  @Delete(':priceListId/lines/:productId')
  @ApiOperation({ summary: 'Remove a line from a price list' })
  async removeLine(
    @Param('priceListId') priceListId: string,
    @Param('productId') productId: string,
  ): Promise<IdResponse> {
    await this.removePriceListLineUseCase.execute({ priceListId, productId });
    return { id: priceListId };
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a price list' })
  async activate(@Param('id') id: string, @Body() dto: ActivatePriceListDto): Promise<IdResponse> {
    await this.activatePriceListUseCase.execute({ ...dto, id });
    return { id };
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a price list' })
  async deactivate(
    @Param('id') id: string,
    @Body() dto: DeactivatePriceListDto,
  ): Promise<IdResponse> {
    await this.deactivatePriceListUseCase.execute({ ...dto, id });
    return { id };
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a price list' })
  async archive(@Param('id') id: string, @Body() dto: ArchivePriceListDto): Promise<IdResponse> {
    await this.archivePriceListUseCase.execute({ ...dto, id });
    return { id };
  }

  @Get('products/:productId/price')
  @ApiOperation({ summary: 'Get purchasable price for a product' })
  async getProductPrice(
    @Param('productId') productId: string,
  ): Promise<{ price: number; currency: string; source: string } | null> {
    return this.getProductPriceUseCase.execute({ productId });
  }
}
