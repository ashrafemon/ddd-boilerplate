import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ChangePriceRequest } from '../../domain/types/product.types';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { ProductCommandRepositoryPort } from '../../domain/domain-ports/product-command-repository.port';
import { ProductIntegrationPort } from '../integrations/publishers/product.integration-port';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class ChangePriceUseCase {
  constructor(
    private readonly productRepository: ProductCommandRepositoryPort,
    private readonly integrationEvent: ProductIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  @Transactional()
  async execute(input: ChangePriceRequest): Promise<ProductId> {
    const company = await this.companyConfig.getCompanyConfig();

    const id = ProductId.fromString(input.id);
    const product = await this.productRepository.findById(id.toString());
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    product.changePrice(
      Money.fromDecimal(input.unitPrice, input.currency ?? company.defaultCurrency),
    );
    await this.productRepository.update(product);

    for (const event of product.pullEvents()) {
      await this.integrationEvent.send(event, product.id.toString());
    }

    return product.id;
  }
}