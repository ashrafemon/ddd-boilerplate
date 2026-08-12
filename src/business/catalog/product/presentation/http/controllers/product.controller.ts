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
import { CreateProductUseCase } from '../../../application/usecase/create-product.usecase';
import { UpdateProductUseCase } from '../../../application/usecase/update-product.usecase';
import { ChangePriceUseCase } from '../../../application/usecase/change-price.usecase';
import { ProductStatusUseCase } from '../../../application/usecase/product-status.usecase';
import { GetProductUseCase } from '../../../application/usecase/get-product.usecase';
import { ListProductsUseCase } from '../../../application/usecase/list-products.usecase';
import {
  ChangePriceDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from '../request/product.request';

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
  async create(@Body() dto: CreateProductDto) {
    const id = await this.createProductUseCase.execute({ ...dto });
    return { data: { id: id.toString() }, message: 'Product created' };
  }

  @Get()
  @ApiOperation({ summary: 'List products' })
  async list(@Query() query: ProductQueryDto) {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.listProductsUseCase.execute(pageQuery);
    return { data: result, message: 'Products fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id' })
  async get(@Param('id') id: string) {
    const product = await this.getProductUseCase.execute(id);
    return { data: product, message: 'Product fetched' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    const productId = await this.updateProductUseCase.execute({ id, ...dto });
    return { data: { id: productId.toString() }, message: 'Product updated' };
  }

  @Post(':id/change-price')
  @ApiOperation({ summary: 'Change product price' })
  async changePrice(@Param('id') id: string, @Body() dto: ChangePriceDto) {
    const productId = await this.changePriceUseCase.execute({ id, ...dto });
    return { data: { id: productId.toString() }, message: 'Product price updated' };
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a product' })
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    const productId = await this.productStatusUseCase.execute({ id, action: 'activate' });
    return { data: { id: productId.toString() }, message: 'Product activated' };
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a product' })
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string) {
    const productId = await this.productStatusUseCase.execute({ id, action: 'deactivate' });
    return { data: { id: productId.toString() }, message: 'Product deactivated' };
  }

  @Post(':id/discontinue')
  @ApiOperation({ summary: 'Discontinue a product' })
  @HttpCode(HttpStatus.OK)
  async discontinue(@Param('id') id: string) {
    const productId = await this.productStatusUseCase.execute({ id, action: 'discontinue' });
    return { data: { id: productId.toString() }, message: 'Product discontinued' };
  }
}
