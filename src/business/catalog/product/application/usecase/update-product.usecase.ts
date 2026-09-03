import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UpdateProductRequest } from '../../domain/types/product.types';
import { ProductId } from '../../domain/value-objects';
import { ProductCommandRepositoryPort } from '../../domain/domain-ports';
import { ProductIntegrationPort } from '../integrations';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class UpdateProductUseCase {
  constructor(
    private readonly productRepository: ProductCommandRepositoryPort,
    private readonly integrationEvent: ProductIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  @Transactional()
  async execute(input: UpdateProductRequest): Promise<ProductId> {
    await this.companyConfig.getCompanyConfig();

    const id = ProductId.fromString(input.id);
    const product = await this.productRepository.findById(id.toString());
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    product.update({ name: input.name, description: input.description });
    await this.productRepository.update(product);

    for (const event of product.pullEvents()) {
      await this.integrationEvent.send(event, product.id.toString());
    }

    return product.id;
  }
}