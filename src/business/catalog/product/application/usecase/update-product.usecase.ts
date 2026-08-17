import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { ProductId } from '../../domain/value-objects';
import {
  ProductCommandRepositoryPort,
  ProductCommandRepositoryPort,
} from '../../domain/domain-ports';

export interface UpdateProductInput {
  id: string;
  name?: string;
  description?: string;
}

@Injectable()
export class UpdateProductUseCase implements CommandUseCase<UpdateProductInput, ProductId> {
  constructor(
    @Inject(ProductCommandRepositoryPort)
    private readonly productRepository: ProductCommandRepositoryPort,
    @Inject(OutboxWriterPort) private readonly outboxWriter: OutboxWriterPort,
    @Inject(CompanyConfigPort) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: UpdateProductInput): Promise<ProductId> {
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
