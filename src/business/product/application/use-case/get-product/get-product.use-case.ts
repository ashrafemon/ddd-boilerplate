import { Injectable } from '@nestjs/common';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { ProductReadRepositoryPort, ProductReadModel } from '../../../domain/port/product-read-repository.port';
import { GetProductInput, ProductOutput } from '../../type/product.output';
import { GetProductPort } from '../../port/get-product.port';

/**
 * Query use case reading a product through the read repository.
 */
@Injectable()
export class GetProductUseCase implements GetProductPort {
  constructor(private readonly readRepository: ProductReadRepositoryPort) {}

  public async execute(input: GetProductInput): Promise<ProductOutput> {
    const readModel = await this.readRepository.findById(input.productId);

    if (!readModel) {
      throw new AggregateNotFoundException('Product', input.productId);
    }

    return toOutput(readModel);
  }
}

export function toOutput(readModel: ProductReadModel): ProductOutput {
  return {
    id: readModel.id,
    tenantId: readModel.tenantId,
    organizationId: readModel.organizationId,
    code: readModel.code,
    name: readModel.name,
    description: readModel.description,
    sku: readModel.sku,
    unit: readModel.unit,
    status: readModel.status,
    isPurchasable: readModel.isPurchasable,
    isSellable: readModel.isSellable,
    priceCents: readModel.priceCents,
    currency: readModel.currency,
    categoryId: readModel.categoryId,
  };
}
