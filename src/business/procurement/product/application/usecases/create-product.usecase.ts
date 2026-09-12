import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { Transactional } from '@nestjs-cls/transactional';
import { ConflictException, Injectable } from '@nestjs/common';
import { ProductCommandRepository } from '../../domain/repositories/product-command.repository';
import { ProductFactory } from '../../domain/factories/product.factory';
import { CreateProductRequest } from '../../domain/types/product.types';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { ProductIntegrationPort } from '../integrations/publishes/product.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';

@Injectable()
export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductCommandRepository,
    private readonly integrationEvent: ProductIntegrationPort,
    private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: CreateProductRequest): Promise<ProductId> {
    const company = await this.companyConfig.getCompanyConfig();
    const currency = input.currency ?? company.defaultCurrency;

    const product = ProductFactory.create({
      sku: input.sku,
      name: input.name,
      description: input.description,
      unitPrice: Money.fromDecimal(input.unitPrice, currency),
      currency,
    });

    const existing = await this.productRepository.findBySku(product.sku);
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
