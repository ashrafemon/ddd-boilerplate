import { Injectable } from '@nestjs/common';
import {
  ChangePriceInput,
  CreateProductInput,
  ProductCommandPort,
  UpdateProductInput,
} from '../ports/inbound/product.command.port';
import { CreateProductUseCase } from './use-cases/create-product.use-case';
import { UpdateProductUseCase } from './use-cases/update-product.use-case';
import { ChangePriceUseCase } from './use-cases/change-price.use-case';
import { ProductStatusUseCase } from './use-cases/product-status.use-case';
import { ProductId } from '../domain/value-objects/product-id.vo';

@Injectable()
export class ProductCommandService implements ProductCommandPort {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly changePriceUseCase: ChangePriceUseCase,
    private readonly productStatusUseCase: ProductStatusUseCase,
  ) {}

  createProduct(input: CreateProductInput): Promise<ProductId> {
    return this.createProductUseCase.execute(input);
  }

  updateProduct(input: UpdateProductInput): Promise<ProductId> {
    return this.updateProductUseCase.execute(input);
  }

  changePrice(input: ChangePriceInput): Promise<ProductId> {
    return this.changePriceUseCase.execute(input);
  }

  activateProduct(id: string): Promise<ProductId> {
    return this.productStatusUseCase.execute({ id, action: 'activate' });
  }

  deactivateProduct(id: string): Promise<ProductId> {
    return this.productStatusUseCase.execute({ id, action: 'deactivate' });
  }

  discontinueProduct(id: string): Promise<ProductId> {
    return this.productStatusUseCase.execute({ id, action: 'discontinue' });
  }
}
