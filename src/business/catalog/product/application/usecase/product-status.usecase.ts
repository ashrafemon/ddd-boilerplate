import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ProductStatusRequest } from '../../domain/types/product.types';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { ProductCommandRepositoryPort } from '../../domain/domain-ports/product-command-repository.port';
import { ProductIntegrationPort } from '../integrations/publishers/product.integration-port';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class ProductStatusUseCase {
  constructor(
    private readonly productRepository: ProductCommandRepositoryPort,
    private readonly integrationEvent: ProductIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  @Transactional()
  async execute(input: ProductStatusRequest): Promise<ProductId> {
    await this.companyConfig.getCompanyConfig();

    const id = ProductId.fromString(input.id);
    const product = await this.productRepository.findById(id.toString());
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    switch (input.action) {
      case 'activate':
        product.activate();
        break;
      case 'deactivate':
        product.deactivate();
        break;
      case 'discontinue':
        product.discontinue();
        break;
    }

    await this.productRepository.update(product);

    for (const event of product.pullEvents()) {
      await this.integrationEvent.send(event, product.id.toString());
    }

    return product.id;
  }
}