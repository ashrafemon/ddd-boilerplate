import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  COMPANY_CONFIG,
  CompanyConfigPort,
} from '@platform/configuration/ports/company-config.port';
import { Money } from '@business/shared-business/domain/money.value-object';
import { ProductId } from '../../domain/value-objects';
import { Money } from '@business/shared-business/domain/money.value-object';
import {
  ProductCommandRepositoryPort,
  ProductCommandRepositoryPort,
} from '../../domain/domain-ports';

export interface ChangePriceInput {
  id: string;
  unitPrice: number;
  currency?: string;
}

@Injectable()
export class ChangePriceUseCase implements CommandUseCase<ChangePriceInput, ProductId> {
  constructor(
    @Inject(ProductCommandRepositoryPort)
    private readonly productRepository: ProductCommandRepositoryPort,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: ChangePriceInput): Promise<ProductId> {
    const company = await this.companyConfig.getCompanyConfig();

    const id = ProductId.fromString(input.id);
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    product.changePrice(
      Money.fromDecimal(input.unitPrice, input.currency ?? company.defaultCurrency),
    );
    await this.productRepository.update(product);

    for (const event of product.pullEvents()) {
      await this.outboxWriter.append(event, 'Product', product.id.toString());
    }

    return product.id;
  }
}
