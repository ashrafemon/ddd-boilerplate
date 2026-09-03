import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { Transactional } from '@nestjs-cls/transactional';
import { ConflictException, Injectable } from '@nestjs/common';
import { ProductCommandRepositoryPort } from '../../domain/domain-ports/product-command-repository.port';
import { productFactory } from '../../domain/factories/product.factory';
import { CreateProductRequest } from '../../domain/types/product.types';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { Sku } from '../../domain/value-objects/sku.vo';
import { ProductIntegrationPort } from '../integrations/publishers/product.integration-port';
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