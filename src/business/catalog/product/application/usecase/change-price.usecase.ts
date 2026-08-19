import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ChangePriceRequest } from '../../domain/types/product.types';
import { ProductId } from '../../domain/value-objects';
import {
  ProductCommandRepositoryPort,
} from '../../domain/domain-ports';

@Injectable()
export class ChangePriceUseCase  {
  constructor(
    @Inject(ProductCommandRepositoryPort)
    private readonly productRepository: ProductCommandRepositoryPort,
    @Inject(OutboxWriterPort) private readonly outboxWriter: OutboxWriterPort,
    @Inject(CompanyConfigPort) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: ChangePriceRequest): Promise<ProductId> {
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
