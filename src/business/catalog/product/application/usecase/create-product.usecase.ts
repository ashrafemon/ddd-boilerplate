import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  COMPANY_CONFIG,
  CompanyConfigPort,
} from '@platform/configuration/ports/company-config.port';
import { Money } from '@business/shared-business/domain/money.value-object';
import { productFactory } from '../../domain/factories/product.factory';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { Sku } from '../../domain/value-objects/sku.vo';
import { ProductErrors } from '../../domain/errors/product.errors';
import {
  PRODUCT_COMMAND_REPOSITORY,
  ProductCommandRepositoryPort,
} from '../../domain/ports/product-command-repository.port';

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  unitPrice: number;
  currency?: string;
}

@Injectable()
export class CreateProductUseCase implements CommandUseCase<CreateProductInput, ProductId> {
  constructor(
    @Inject(PRODUCT_COMMAND_REPOSITORY)
    private readonly productRepository: ProductCommandRepositoryPort,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: CreateProductInput): Promise<ProductId> {
    // Orchestration step 1: resolve the company configuration from the platform.
    const company = await this.companyConfig.getCompanyConfig();
    const currency = input.currency ?? company.defaultCurrency;

    // Orchestration step 2: create the aggregate through the domain factory.
    const product = productFactory.create({
      sku: input.sku,
      name: input.name,
      description: input.description,
      unitPrice: Money.fromDecimal(input.unitPrice, currency),
      currency,
    });

    const existing = await this.productRepository.findBySku(Sku.create(product.sku));
    if (existing) {
      throw ProductErrors.skuConflict(product.sku);
    }

    // Orchestration step 3: persist the aggregate through the command repository.
    await this.productRepository.save(product);

    // Orchestration step 4: persist domain events to the outbox + dispatch in-process.
    for (const event of product.pullEvents()) {
      await this.outboxWriter.append(event, 'Product', product.id.toString());
    }

    return product.id;
  }
}
