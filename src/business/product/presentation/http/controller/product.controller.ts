import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { zodValidationPipe } from '../../../../../shared-kernel/pipes/zod-validation.pipe';
import { CreateProductRequestSchema, UpdateProductRequestSchema } from '../request/product.request';
import { Roles } from '../../../../../shared-kernel/http/decorator/roles.decorator';
import { CreateProductUseCase } from '../../../application/use-case/create-product/create-product.use-case';
import { GetProductUseCase } from '../../../application/use-case/get-product/get-product.use-case';
import { ActivateProductUseCase, DeactivateProductUseCase } from '../../../application/use-case/update-product/product-status.use-case';
import { UpdateProductUseCase } from '../../../application/use-case/update-product/update-product.use-case';
import { ProductOutput } from '../../../application/type/product.output';
import { CreateProductInput } from '../../../application/type/create-product.input';
import { UpdateProductInput } from '../../../application/type/update-product.input';

/**
 * Thin HTTP controller for the Product bounded context.
 */
@Controller('products')
export class ProductController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly activateProductUseCase: ActivateProductUseCase,
    private readonly deactivateProductUseCase: DeactivateProductUseCase,
  ) {}

  @Post()
  @Roles('product.manager')
  public async create(@Body(zodValidationPipe(CreateProductRequestSchema)) body: CreateProductInput) {
    return this.createProductUseCase.execute(body);
  }

  @Get(':productId')
  @Roles('product.viewer', 'purchase.admin')
  public async get(@Param('productId') productId: string): Promise<ProductOutput> {
    return this.getProductUseCase.execute({ productId });
  }

  @Patch(':productId')
  @Roles('product.manager')
  public async update(
    @Param('productId') productId: string,
    @Body(zodValidationPipe(UpdateProductRequestSchema)) body: Omit<UpdateProductInput, 'productId'>,
  ) {
    return this.updateProductUseCase.execute({ productId, ...body });
  }

  @Post(':productId/activate')
  @HttpCode(HttpStatus.OK)
  @Roles('product.manager')
  public async activate(@Param('productId') productId: string) {
    return this.activateProductUseCase.execute({ productId });
  }

  @Post(':productId/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles('product.manager')
  public async deactivate(@Param('productId') productId: string) {
    return this.deactivateProductUseCase.execute({ productId });
  }
}
