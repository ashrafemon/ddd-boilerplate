import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { Transactional } from '@nestjs-cls/transactional';
import { ConflictException, Injectable } from '@nestjs/common';
import { ProductCommandRepositoryPort } from '../../domain/domain-ports';
import { productFactory } from '../../domain/factories';
import { CreateProductRequest } from '../../domain/types/product.types';
import { ProductId, Sku } from '../../domain/value-objects';
import { ProductIntegrationPort } from '../integrations';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductCommandRepositoryPort,
    private readonly integrationEvent: ProductIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  @Transactional()
  async execute(input: CreateProductRequest): Promise<ProductId> {
    const company = await this.companyConfig.getCompanyConfig();
    const currency = input.currency ?? company.defaultCurrency;

    const product = productFactory.create({
      sku: input.sku,
      name: input.name,
      description: input.description,
      unitPrice: Money.fromDecimal(input.unitPrice, currency),
      currency,
    });

    const existing = await this.productRepository.findBySku(Sku.create(product.sku).toString());
    if (existing) {
      throw new ConflictException(`Product with SKU "${product.sku}" already exists`);
    }

    await this.productRepository.save(product);

    for (const event of product.pullEvents()) {
      await this.integrationEvent.send(event, product.id.toString());
    }

    return product.id;
  }
}