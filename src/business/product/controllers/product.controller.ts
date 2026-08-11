import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductCommandPort, PRODUCT_COMMAND_PORT } from '../ports/inbound/product.command.port';
import { ProductQueryPort, PRODUCT_QUERY_PORT } from '../ports/inbound/product.query.port';
import { ProductId } from '../domain/value-objects/product-id.vo';
import {
  ChangePriceDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from '../dto/product.dto';
import { PageQuery, normalizePageQuery } from '@shared-kernal/types/pagination';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(
    @Inject(PRODUCT_COMMAND_PORT) private readonly commands: ProductCommandPort,
    @Inject(PRODUCT_QUERY_PORT) private readonly queries: ProductQueryPort,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a product' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProductDto) {
    const id = await this.commands.createProduct({ ...dto });
    return { data: { id: id.toString() }, message: 'Product created' };
  }

  @Get()
  @ApiOperation({ summary: 'List products' })
  async list(@Query() query: ProductQueryDto) {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.queries.listProducts(pageQuery);
    return { data: result, message: 'Products fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id' })
  async get(@Param('id') id: string) {
    const product = await this.queries.getProduct(ProductId.fromString(id));
    return { data: product, message: 'Product fetched' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    const productId = await this.commands.updateProduct({ id, ...dto });
    return { data: { id: productId.toString() }, message: 'Product updated' };
  }

  @Post(':id/change-price')
  @ApiOperation({ summary: 'Change product price' })
  async changePrice(@Param('id') id: string, @Body() dto: ChangePriceDto) {
    const productId = await this.commands.changePrice({ id, ...dto });
    return { data: { id: productId.toString() }, message: 'Product price updated' };
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a product' })
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    const productId = await this.commands.activateProduct(id);
    return { data: { id: productId.toString() }, message: 'Product activated' };
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a product' })
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string) {
    const productId = await this.commands.deactivateProduct(id);
    return { data: { id: productId.toString() }, message: 'Product deactivated' };
  }

  @Post(':id/discontinue')
  @ApiOperation({ summary: 'Discontinue a product' })
  @HttpCode(HttpStatus.OK)
  async discontinue(@Param('id') id: string) {
    const productId = await this.commands.discontinueProduct(id);
    return { data: { id: productId.toString() }, message: 'Product discontinued' };
  }
}
