import {
  Body,
  Controller,
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
import { ChangePriceUseCase } from '../../application/usecases/change-price.usecase';
import { CreateProductUseCase } from '../../application/usecases/create-product.usecase';
import { GetProductUseCase } from '../../application/usecases/get-product.usecase';
import { ListProductsUseCase } from '../../application/usecases/list-products.usecase';
import { ProductStatusUseCase } from '../../application/usecases/product-status.usecase';
import { UpdateProductUseCase } from '../../application/usecases/update-product.usecase';
import { ChangePriceDto } from './requests/change-price.request.dto';
import { CreateProductDto } from './requests/create-product.request.dto';
import { ProductQueryDto } from './requests/query-products.request.dto';
import { UpdateProductDto } from './requests/update-product.request.dto';
import { DeviceContext } from '@shared-kernel/decorators/device-context.decorator';
import { DeviceResponse } from '@shared-kernel/decorators/device-response.decorator';
import { ApiResponse } from '@shared-kernel/types/api-response.type';
import { GetProductMobileResponseSchema } from './responses/get-product.mobile.response.dto';
import { GetProductWebResponseSchema } from './responses/get-product.web.response.dto';
import { ListProductsMobileResponseSchema } from './responses/list-products.mobile.response.dto';
import { ListProductsWebResponseSchema } from './responses/list-products.web.response.dto';
import { IdResponse } from './responses/id.response.dto';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly changePriceUseCase: ChangePriceUseCase,
    private readonly productStatusUseCase: ProductStatusUseCase,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly listProductsUseCase: ListProductsUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a product' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProductDto): Promise<ApiResponse<IdResponse>> {
    const id = await this.createProductUseCase.execute({ ...dto });
    return { data: { id: id.toString() }, message: 'Product created' };
  }

  @Get()
  @ApiOperation({ summary: 'List products' })
  @DeviceResponse(ListProductsMobileResponseSchema, ListProductsWebResponseSchema)
  async list(@Query() query: ProductQueryDto): Promise<ApiResponse<unknown>> {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.listProductsUseCase.execute(pageQuery);
    return { data: result, message: 'Products fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id' })
  @DeviceResponse(GetProductMobileResponseSchema, GetProductWebResponseSchema)
  async get(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const product = await this.getProductUseCase.execute(id);
    if (!product) {
      return { data: null, message: 'Product fetched' };
    }
    return { data: product, message: 'Product fetched' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ApiResponse<IdResponse>> {
    const productId = await this.updateProductUseCase.execute({ id, ...dto });
    return { data: { id: productId.toString() }, message: 'Product updated' };
  }

  @Patch(':id/change-price')
  @ApiOperation({ summary: 'Change product price' })
  async changePrice(
    @Param('id') id: string,
    @Body() dto: ChangePriceDto,
  ): Promise<ApiResponse<IdResponse>> {
    const productId = await this.changePriceUseCase.execute({ id, ...dto });
    return { data: { id: productId.toString() }, message: 'Product price updated' };
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a product' })
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const productId = await this.productStatusUseCase.execute({ id, action: 'activate' });
    return { data: { id: productId.toString() }, message: 'Product activated' };
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a product' })
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const productId = await this.productStatusUseCase.execute({ id, action: 'deactivate' });
    return { data: { id: productId.toString() }, message: 'Product deactivated' };
  }

  @Patch(':id/discontinue')
  @ApiOperation({ summary: 'Discontinue a product' })
  @HttpCode(HttpStatus.OK)
  async discontinue(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const productId = await this.productStatusUseCase.execute({ id, action: 'discontinue' });
    return { data: { id: productId.toString() }, message: 'Product discontinued' };
  }
}
