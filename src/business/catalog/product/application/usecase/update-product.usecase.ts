import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { UpdateProductRequest } from '../../domain/types/product.types';
import { ProductId } from '../../domain/value-objects';
import { ProductCommandRepositoryPort } from '../../domain/domain-ports';

@Injectable()
export class UpdateProductUseCase {
  constructor(
    private readonly productRepository: ProductCommandRepositoryPort,
    private readonly outboxWriter: OutboxWriterPort,
    private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: UpdateProductRequest): Promise<ProductId> {
    await this.companyConfig.getCompanyConfig();

    const id = ProductId.fromString(input.id);
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    product.update({ name: input.name, description: input.description });
    await this.productRepository.update(product);

    for (const event of product.pullEvents()) {
      await this.outboxWriter.append(event, 'Product', product.id.toString());
    }

    return product.id;
  }
}
